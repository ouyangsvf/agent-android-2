/**
 * AgentService - WebSocket连接管理
 * 处理与OpenClaw服务器的通信
 */

import { Platform } from 'react-native';
import BackgroundTimer from 'react-native-background-timer';

export class AgentService {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.deviceId = config.deviceId;
    this.authToken = config.authToken;
    this.onConnect = config.onConnect || (() => {});
    this.onDisconnect = config.onDisconnect || (() => {});
    this.onCommand = config.onCommand || (() => {});
    this.onError = config.onError || (() => {});

    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 100;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.isConnected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.serverUrl}?deviceId=${this.deviceId}&token=${this.authToken}`;
        
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket 已连接');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.onConnect();
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this.handleMessage(message);
          } catch (error) {
            console.error('消息解析错误:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          this.onError(error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('❌ WebSocket 关闭');
          this.isConnected = false;
          this.stopHeartbeat();
          this.onDisconnect();
          this.scheduleReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  async handleMessage(message) {
    console.log('📨 收到消息:', message.type);

    switch (message.type) {
      case 'PONG':
        // 心跳响应
        break;

      case 'COMMAND':
        // 执行指令
        try {
          const result = await this.onCommand(message.payload);
          this.sendResponse(message.payload.id, 'success', result);
        } catch (error) {
          this.sendResponse(message.payload.id, 'error', { message: error.message });
        }
        break;

      case 'DEVICE_REGISTERED':
        console.log('✅ 设备已注册:', message.deviceId);
        break;

      default:
        console.log('未知消息类型:', message.type);
    }
  }

  sendResponse(commandId, status, result) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'RESPONSE',
        commandId,
        status,
        result,
        timestamp: Date.now(),
      }));
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = BackgroundTimer.runBackgroundTimer(() => {
      if (this.isConnected) {
        this.ws.send(JSON.stringify({
          type: 'PING',
          timestamp: Date.now(),
        }));
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      BackgroundTimer.stopBackgroundTimer(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ 达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000
    );

    console.log(`⏰ ${delay}ms 后重连 (第 ${this.reconnectAttempts} 次)`);

    setTimeout(() => {
      this.connect().catch(() => {
        // 重连失败会在 onclose 中再次触发 scheduleReconnect
      });
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
