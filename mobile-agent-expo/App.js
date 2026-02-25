import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';

// WebSocket 服务
class AgentService {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.deviceId = config.deviceId;
    this.onConnect = config.onConnect || (() => {});
    this.onDisconnect = config.onDisconnect || (() => {});
    this.onMessage = config.onMessage || (() => {});
    this.ws = null;
    this.reconnectTimer = null;
  }

  connect() {
    try {
      const url = `${this.serverUrl}?deviceId=${this.deviceId}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ 已连接');
        this.onConnect();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      };

      this.ws.onclose = () => {
        console.log('❌ 断开连接');
        this.onDisconnect();
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
      };
    } catch (error) {
      console.error('连接失败:', error);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default function App() {
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');
  const [deviceId, setDeviceId] = useState('');
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showConfig, setShowConfig] = useState(true);
  const agentRef = useRef(null);

  useEffect(() => {
    initDevice();
  }, []);

  const initDevice = async () => {
    // 生成或加载设备ID
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id = `mobile-${Date.now()}`;
      await AsyncStorage.setItem('deviceId', id);
    }
    setDeviceId(id);

    // 加载服务器地址
    const savedUrl = await AsyncStorage.getItem('serverUrl');
    if (savedUrl) {
      setServerUrl(savedUrl);
    }

    addLog(`设备ID: ${id}`);
    addLog(`型号: ${Device.modelName || 'Unknown'}`);
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  const connect = async () => {
    if (!serverUrl) {
      Alert.alert('错误', '请输入服务器地址');
      return;
    }

    addLog('正在连接...');
    
    await AsyncStorage.setItem('serverUrl', serverUrl);

    const agent = new AgentService({
      serverUrl,
      deviceId,
      onConnect: () => {
        setConnected(true);
        addLog('✅ 已连接服务器');
      },
      onDisconnect: () => {
        setConnected(false);
        addLog('❌ 连接断开');
      },
      onMessage: handleCommand,
    });

    agent.connect();
    agentRef.current = agent;
  };

  const disconnect = () => {
    if (agentRef.current) {
      agentRef.current.disconnect();
      agentRef.current = null;
    }
    setConnected(false);
    addLog('已手动断开');
  };

  const handleCommand = async (command) => {
    addLog(`📥 收到: ${command.type}`);
    
    try {
      let result;
      
      switch (command.type) {
        case 'PING':
          result = { pong: true, time: Date.now() };
          break;
          
        case 'SYSTEM_INFO':
          const batteryLevel = await Battery.getBatteryLevelAsync();
          result = {
            platform: Device.platform,
            model: Device.modelName,
            osVersion: Device.osVersion,
            battery: batteryLevel,
            deviceId,
          };
          break;
          
        case 'NOTIFICATION':
          // 在App内显示通知
          Alert.alert(command.payload.title, command.payload.body);
          result = { success: true };
          break;
          
        default:
          result = { error: '未知指令: ' + command.type };
      }

      // 发送响应
      agentRef.current?.send({
        type: 'RESPONSE',
        id: command.id,
        result,
      });
      
      addLog(`✅ 执行成功`);
    } catch (error) {
      addLog(`❌ 错误: ${error.message}`);
      agentRef.current?.send({
        type: 'RESPONSE',
        id: command.id,
        error: error.message,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 Mobile Agent</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, connected ? styles.online : styles.offline]} />
          <Text style={styles.statusText}>{connected ? '🟢 在线' : '🔴 离线'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {showConfig && (
          <View style={styles.section}>
            <Text style={styles.label}>服务器地址 (ws:// 或 wss://)</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="ws://localhost:8080"
              autoCapitalize="none"
            />
            
            <Text style={styles.label}>设备ID</Text>
            <TextInput
              style={[styles.input, styles.disabled]}
              value={deviceId}
              editable={false}
            />

            <TouchableOpacity
              style={[styles.button, connected ? styles.disconnectBtn : styles.connectBtn]}
              onPress={connected ? disconnect : connect}
            >
              <Text style={styles.buttonText}>
                {connected ? '断开连接' : '连接服务器'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>📋 运行日志</Text>
          <ScrollView style={styles.logBox}>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    backgroundColor: '#16213e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
  },
  content: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  disabled: {
    opacity: 0.6,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectBtn: {
    backgroundColor: '#4CAF50',
  },
  disconnectBtn: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logBox: {
    backgroundColor: '#0f0f1e',
    padding: 10,
    borderRadius: 6,
    maxHeight: 300,
  },
  logText: {
    color: '#0f0',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
