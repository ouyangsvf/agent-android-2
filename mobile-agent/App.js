/**
 * Mobile Agent v2.0 - 智能设备助手
 * 全新设计：玻璃拟态 + 渐变 + 流畅动画
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { AgentService } from './src/services/AgentService';
import { LogViewer } from './src/components/LogViewer';
import { ActionExecutor } from './src/services/ActionExecutor';
import { QuickActions } from './src/components/QuickActions';
import { Dashboard } from './src/components/Dashboard';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const { width, height } = Dimensions.get('window');

// 主应用组件
const AppContent = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [logs, setLogs] = useState([]);
  const [currentView, setCurrentView] = useState('home');
  const [subMenu, setSubMenu] = useState(null); // 子菜单状态
  const [agentService, setAgentService] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stats, setStats] = useState({
    commandsExecuted: 0,
    connectedTime: 0,
    lastCommand: null,
  });

  // 动画值
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    initializeApp();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  };

  const initializeApp = async () => {
    try {
      let storedDeviceId = await AsyncStorage.getItem('deviceId');
      if (!storedDeviceId) {
        storedDeviceId = `移动设备-${Date.now().toString(36).toUpperCase()}`;
        await AsyncStorage.setItem('deviceId', storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      const storedUrl = await AsyncStorage.getItem('serverUrl') || '';
      setServerUrl(storedUrl);

      const storedToken = await AsyncStorage.getItem('authToken') || '';
      setAuthToken(storedToken);

      const deviceInfo = await getDeviceInfo();
      addLog(`📱 设备就绪: ${deviceInfo.brand} ${deviceInfo.model}`);
      addLog(`🔑 设备标识: ${storedDeviceId}`);
    } catch (error) {
      addLog(`❌ 初始化失败: ${error.message}`);
    }
  };

  const getDeviceInfo = async () => {
    return {
      brand: await DeviceInfo.getBrand(),
      model: await DeviceInfo.getModel(),
      systemVersion: DeviceInfo.getSystemVersion(),
      batteryLevel: await DeviceInfo.getBatteryLevel(),
    };
  };

  const addLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 200));
  }, []);

  const connectToServer = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('⚠️ 提示', '请先输入服务器地址');
      return;
    }
    setIsConnecting(true);
    addLog('🔄 正在连接服务器...');

    try {
      const service = new AgentService({
        serverUrl: serverUrl.trim(),
        deviceId,
        authToken: authToken.trim(),
        onConnect: () => {
          setIsConnected(true);
          setIsConnecting(false);
          addLog('✅ 连接成功！服务器已就绪');
          setStats(prev => ({ ...prev, connectedTime: Date.now() }));
        },
        onDisconnect: () => {
          setIsConnected(false);
          setIsConnecting(false);
          addLog('❌ 连接已断开');
        },
        onCommand: handleCommand,
        onError: (error) => {
          addLog(`⚠️ 错误: ${error.message}`);
          setIsConnecting(false);
        },
      });

      await service.connect();
      setAgentService(service);
      await AsyncStorage.setItem('serverUrl', serverUrl.trim());
      if (authToken.trim()) await AsyncStorage.setItem('authToken', authToken.trim());

    } catch (error) {
      setIsConnecting(false);
      addLog(`❌ 连接失败: ${error.message}`);
      Alert.alert('连接失败', error.message);
    }
  };

  const disconnect = async () => {
    if (agentService) {
      addLog('🔄 正在断开连接...');
      await agentService.disconnect();
      setAgentService(null);
      setIsConnected(false);
      addLog('✅ 已断开连接');
    }
  };

  const handleCommand = async (command) => {
    addLog(`📥 收到指令: ${command.type}`);
    try {
      const executor = new ActionExecutor();
      const result = await executor.execute(command);
      addLog(`✅ 执行成功: ${command.type}`);
      setStats(prev => ({ ...prev, commandsExecuted: prev.commandsExecuted + 1, lastCommand: { type: command.type, time: Date.now() } }));
      return result;
    } catch (error) {
      addLog(`❌ 执行失败: ${error.message}`);
      throw error;
    }
  };

  // 执行快捷操作
  const executeQuickAction = async (actionType, payload = {}) => {
    if (!isConnected) {
      Alert.alert('⚠️ 提示', '请先连接服务器');
      return;
    }

    const actionNames = {
      ping: '连接测试', sms: '读取短信', contacts: '读取通讯录', location: '获取位置',
      camera: '拍照', screenshot: '截图', battery: '电池状态', memory: '内存信息',
      clipboard_get: '获取剪贴板', clipboard_set: '设置剪贴板',
      file_list: '文件列表', file_download: '下载文件',
      network_info: '网络信息',
      app_list: '应用列表', app_launch: '启动应用',
      audio_record: '录音', audio_play: '播放音频', audio_stop: '停止录音',
      qrcode_scan: '扫码',
      control_brightness: '调节亮度', control_volume: '调节音量', control_wifi: 'WiFi开关',
      task_schedule: '计划任务', task_cancel: '取消任务',
    };

    addLog(`🚀 ${actionNames[actionType] || actionType}`);

    try {
      const commands = {
        ping: { type: 'PING', id: `quick-${Date.now()}` },
        sms: { type: 'SMS_READ', id: `quick-${Date.now()}`, payload: { limit: 5 } },
        contacts: { type: 'CONTACTS_READ', id: `quick-${Date.now()}` },
        location: { type: 'LOCATION_GET', id: `quick-${Date.now()}` },
        camera: { type: 'CAMERA_CAPTURE', id: `quick-${Date.now()}` },
        screenshot: { type: 'SCREENSHOT', id: `quick-${Date.now()}` },
        battery: { type: 'SYSTEM_INFO', id: `quick-${Date.now()}`, payload: { type: 'battery' } },
        memory: { type: 'SYSTEM_INFO', id: `quick-${Date.now()}`, payload: { type: 'memory' } },
        clipboard_get: { type: 'CLIPBOARD_GET', id: `quick-${Date.now()}` },
        clipboard_set: { type: 'CLIPBOARD_SET', id: `quick-${Date.now()}`, payload },
        file_list: { type: 'FILE_LIST', id: `quick-${Date.now()}`, payload },
        file_download: { type: 'FILE_DOWNLOAD', id: `quick-${Date.now()}`, payload },
        network_info: { type: 'NETWORK_INFO', id: `quick-${Date.now()}` },
        app_list: { type: 'APP_LIST', id: `quick-${Date.now()}` },
        app_launch: { type: 'APP_LAUNCH', id: `quick-${Date.now()}`, payload },
        audio_record: { type: 'AUDIO_RECORD', id: `quick-${Date.now()}`, payload },
        audio_play: { type: 'AUDIO_PLAY', id: `quick-${Date.now()}`, payload },
        audio_stop: { type: 'AUDIO_STOP', id: `quick-${Date.now()}`, payload },
        qrcode_scan: { type: 'QRCODE_SCAN', id: `quick-${Date.now()}` },
        control_brightness: { type: 'DEVICE_CONTROL', id: `quick-${Date.now()}`, payload: { action: 'brightness', ...payload } },
        control_volume: { type: 'DEVICE_CONTROL', id: `quick-${Date.now()}`, payload: { action: 'volume', ...payload } },
        control_wifi: { type: 'DEVICE_CONTROL', id: `quick-${Date.now()}`, payload: { action: 'wifi', ...payload } },
        task_schedule: { type: 'TASK_SCHEDULE', id: `quick-${Date.now()}`, payload },
        task_cancel: { type: 'TASK_CANCEL', id: `quick-${Date.now()}`, payload },
      };

      const result = await handleCommand(commands[actionType]);
      Alert.alert(`${actionNames[actionType]} 完成`, JSON.stringify(result, null, 2).substring(0, 500));
      setSubMenu(null);
    } catch (error) {
      Alert.alert('执行失败', error.message);
    }
  };

  const handleQuickAction = (key, data) => {
    if (key === 'show_submenu') {
      setSubMenu(data);
    } else {
      executeQuickAction(key);
    }
  };

  // 子菜单模态框
  const renderSubMenu = () => {
    if (!subMenu) return null;

    const subActionLabels = {
      clipboard_get: { icon: '📋', label: '获取剪贴板内容' },
      clipboard_set: { icon: '✏️', label: '设置剪贴板' },
      file_list: { icon: '📁', label: '浏览文件' },
      file_download: { icon: '⬇️', label: '下载文件' },
      audio_record: { icon: '🎙️', label: '开始录音' },
      audio_play: { icon: '▶️', label: '播放音频' },
      audio_stop: { icon: '⏹️', label: '停止录音' },
      control_brightness: { icon: '☀️', label: '调节亮度' },
      control_volume: { icon: '🔊', label: '调节音量' },
      control_wifi: { icon: '📶', label: 'WiFi 开关' },
      task_schedule: { icon: '⏰', label: '创建计划' },
      task_cancel: { icon: '❌', label: '取消任务' },
    };

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!subMenu}
        onRequestClose={() => setSubMenu(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>选择操作</Text>
            {subMenu.actions.map((actionKey) => {
              const item = subActionLabels[actionKey] || { icon: '⚡', label: actionKey };
              return (
                <TouchableOpacity
                  key={actionKey}
                  style={styles.modalItem}
                  onPress={() => executeQuickAction(actionKey)}
                >
                  <Text style={styles.modalIcon}>{item.icon}</Text>
                  <Text style={[styles.modalItemText, { color: theme.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setSubMenu(null)}>
              <Text style={{ color: '#f44336' }}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🗑️ 日志已清空');
  };

  // 渲染导航栏
  const renderNavBar = () => (
    <View style={[styles.navBar, { backgroundColor: theme.card }]}>
      {[
        { key: 'home', icon: '🏠', label: '首页' },
        { key: 'dashboard', icon: '📊', label: '数据' },
        { key: 'logs', icon: '📝', label: '日志' },
        { key: 'config', icon: '⚙️', label: '设置' },
      ].map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.navItem, currentView === item.key && styles.navItemActive]}
          onPress={() => setCurrentView(item.key)}
        >
          <Text style={styles.navIcon}>{item.icon}</Text>
          <Text style={[styles.navLabel, { color: currentView === item.key ? theme.primary : theme.textSecondary }]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 渲染首页
  const renderHome = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={[styles.statusCard, { backgroundColor: theme.card }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={[styles.statusTitle, { color: theme.text }]}>连接状态</Text>
            <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
              {isConnected ? '已连接到 OpenClaw' : '等待连接'}
            </Text>
          </View>
          <Animated.View style={[styles.statusIndicator, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }]} />
          </Animated.View>
        </View>
        
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: isConnected ? '#f44336' : theme.primary, opacity: isConnecting ? 0.7 : 1 }]}
          onPress={isConnected ? disconnect : connectToServer}
          disabled={isConnecting}
        >
          <Text style={styles.mainButtonText}>
            {isConnecting ? '连接中...' : isConnected ? '断开连接' : '连接服务器'}
          </Text>
        </TouchableOpacity>
      </View>

      {isConnected && <QuickActions onAction={handleQuickAction} theme={theme} />}

      <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>📱 设备信息</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>设备标识</Text>
          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>{deviceId || '未生成'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>服务器</Text>
          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>{serverUrl || '未配置'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>执行统计</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{stats.commandsExecuted} 条指令</Text>
        </View>
      </View>
    </ScrollView>
  );

  // 渲染配置页
  const renderConfig = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={[styles.configCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>⚙️ 服务器配置</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>服务器地址 (wss://)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="wss://your-server.com"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>认证密钥 (可选)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
            value={authToken}
            onChangeText={setAuthToken}
            placeholder="从 OpenClaw 获取"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>设备标识 (只读)</Text>
          <TextInput
            style={[styles.input, styles.disabledInput, { backgroundColor: theme.inputBackground, color: theme.textSecondary, borderColor: theme.border }]}
            value={deviceId}
            editable={false}
          />
        </View>
      </View>

      <View style={[styles.configCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>🎨 外观设置</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>深色模式</Text>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: theme.primary }} />
        </View>
      </View>

      <TouchableOpacity style={[styles.clearButton, { borderColor: '#f44336' }]} onPress={clearLogs}>
        <Text style={{ color: '#f44336' }}>🗑️ 清空日志</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // 渲染日志页
  const renderLogs = () => (
    <View style={[styles.logsContainer, { backgroundColor: theme.card }]}>
      <View style={styles.logsHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>📝 运行日志</Text>
        <TouchableOpacity onPress={clearLogs}>
          <Text style={{ color: '#f44336' }}>清空</Text>
        </TouchableOpacity>
      </View>
      <LogViewer logs={logs} theme={theme} />
    </View>
  );

  // 渲染数据页
  const renderDashboard = () => <Dashboard stats={stats} isConnected={isConnected} theme={theme} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>🤖 智能设备助手</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Mobile Agent v2.0</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={[styles.badgeText, { color: isConnected ? '#4CAF50' : '#f44336' }]}>
            {isConnected ? '在线' : '离线'}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {currentView === 'home' && renderHome()}
        {currentView === 'config' && renderConfig()}
        {currentView === 'logs' && renderLogs()}
        {currentView === 'dashboard' && renderDashboard()}
      </View>

      {renderNavBar()}
      {renderSubMenu()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  
  statusCard: { borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusTitle: { fontSize: 18, fontWeight: '600' },
  statusSubtitle: { fontSize: 13, marginTop: 4 },
  statusIndicator: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  statusDot: { width: 16, height: 16, borderRadius: 8, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
  mainButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  infoCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)' },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 10 },
  
  configCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, marginBottom: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, fontSize: 15 },
  disabledInput: { opacity: 0.6 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 15 },
  clearButton: { alignItems: 'center', paddingVertical: 14, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  
  logsContainer: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' },
  logsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)' },
  
  navBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)' },
  navItem: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 12 },
  navItemActive: { backgroundColor: 'rgba(100,149,237,0.1)' },
  navIcon: { fontSize: 20, marginBottom: 2 },
  navLabel: { fontSize: 11 },
  
  // 模态框
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)' },
  modalIcon: { fontSize: 24, marginRight: 16, width: 32 },
  modalItemText: { fontSize: 16, flex: 1 },
  modalCancel: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
});

const App = () => (
  <ThemeProvider>
    <AppContent />
  </ThemeProvider>
);

export default App;
