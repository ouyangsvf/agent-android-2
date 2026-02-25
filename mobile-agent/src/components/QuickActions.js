/**
 * QuickActions - 快捷操作面板 (v2.0)
 * 玻璃拟态风格按钮网格 - 扩展版
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';

const { width } = Dimensions.get('window');
const BUTTON_SIZE = (width - 80) / 4;

export const QuickActions = ({ onAction, theme }) => {
  const actionGroups = [
    {
      title: '基础功能',
      actions: [
        { key: 'ping', icon: '🔔', label: '连接测试', color: '#4CAF50' },
        { key: 'sms', icon: '💬', label: '短信', color: '#2196F3' },
        { key: 'contacts', icon: '👥', label: '通讯录', color: '#9C27B0' },
        { key: 'location', icon: '📍', label: '位置', color: '#F44336' },
      ],
    },
    {
      title: '媒体与设备',
      actions: [
        { key: 'camera', icon: '📷', label: '拍照', color: '#FF9800' },
        { key: 'screenshot', icon: '📱', label: '截图', color: '#00BCD4' },
        { key: 'battery', icon: '🔋', label: '电池', color: '#8BC34A' },
        { key: 'memory', icon: '💾', label: '内存', color: '#607D8B' },
      ],
    },
    {
      title: '新增功能',
      actions: [
        { key: 'clipboard', icon: '📋', label: '剪贴板', color: '#FF5722' },
        { key: 'files', icon: '📁', label: '文件', color: '#795548' },
        { key: 'network', icon: '🌐', label: '网络', color: '#3F51B5' },
        { key: 'apps', icon: '📲', label: '应用', color: '#E91E63' },
        { key: 'audio', icon: '🎙️', label: '录音', color: '#9C27B0' },
        { key: 'qrcode', icon: '🔲', label: '扫码', color: '#009688' },
        { key: 'control', icon: '🎛️', label: '控制', color: '#FF5722' },
        { key: 'schedule', icon: '⏰', label: '计划', color: '#673AB7' },
      ],
    },
  ];

  const handleAction = (key) => {
    // 展开子菜单或执行
    const subActions = {
      clipboard: ['clipboard_get', 'clipboard_set'],
      files: ['file_list', 'file_download'],
      apps: ['app_list', 'app_launch'],
      audio: ['audio_record', 'audio_play', 'audio_stop'],
      control: ['control_brightness', 'control_volume', 'control_wifi'],
      schedule: ['task_schedule', 'task_cancel'],
    };

    if (subActions[key]) {
      onAction('show_submenu', { parent: key, actions: subActions[key] });
    } else {
      onAction(key);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.card }]}
      showsVerticalScrollIndicator={false}
    >
      {actionGroups.map((group, groupIndex) => (
        <View key={groupIndex} style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
            {group.title}
          </Text>
          <View style={styles.grid}>
            {group.actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={[styles.button, { backgroundColor: `${action.color}15` }]}
                onPress={() => handleAction(action.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${action.color}25` }]}>
                  <Text style={styles.icon}>{action.icon}</Text>
                </View>
                <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    maxHeight: 500,
  },
  group: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE + 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
