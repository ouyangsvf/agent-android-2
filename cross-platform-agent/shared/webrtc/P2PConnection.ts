/**
 * WebRTC P2P连接管理
 * 设备间直接通信，无需服务器中转数据
 */

import { EventEmitter } from 'events';
import { SignalSession, EncryptedMessage } from '../signal/SignalProtocol';

// ICE服务器配置（STUN/TURN）
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  // Google公共STUN服务器
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // 自建TURN服务器（通过Docker部署）
  {
    urls: 'turn:your-domain.com:3478',
    username: 'agent',
    credential: 'your-turn-password',
  },
  {
    urls: 'turns:your-domain.com:5349',
    username: 'agent',
    credential: 'your-turn-password',
  },
];

/**
 * P2P连接配置
 */
export interface P2PConfig {
  iceServers?: RTCIceServer[];
  isInitiator?: boolean;
  deviceId: string;
  targetDeviceId: string;
  signalSession: SignalSession;  // Signal Protocol会话
}

/**
 * P2P数据通道消息
 */
export interface P2PMessage {
  type: 'command' | 'response' | 'file' | 'stream' | 'ping';
  id: string;
  timestamp: number;
  payload: any;
  // 加密后的内容
  encrypted?: EncryptedMessage;
}

/**
 * WebRTC P2P连接
 */
export class P2PConnection extends EventEmitter {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private config: P2PConfig;
  private connectionState: RTCPeerConnectionState = 'new';
  private iceGatheringComplete = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(config: P2PConfig) {
    super();
    this.config = config;
    
    // 创建RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: config.iceServers || DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    this.setupPeerConnection();
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    if (this.config.isInitiator) {
      // 发起方：创建DataChannel
      this.dataChannel = this.pc.createDataChannel('agent-control', {
        ordered: true,
        maxRetransmits: 3,
      });
      this.setupDataChannel(this.dataChannel);

      // 创建offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 等待ICE收集完成
      await this.waitForIceGathering();

      // 发送加密后的SDP给信令服务器
      this.emit('signal', {
        type: 'offer',
        sdp: this.pc.localDescription,
        from: this.config.deviceId,
        to: this.config.targetDeviceId,
      });
    }
    // 接收方在收到offer后处理
  }

  /**
   * 处理远程SDP
   */
  async handleRemoteSignal(signal: any): Promise<void> {
    switch (signal.type) {
      case 'offer':
        await this.handleOffer(signal.sdp);
        break;
      case 'answer':
        await this.handleAnswer(signal.sdp);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(signal.candidate);
        break;
    }
  }

  /**
   * 处理Offer（接收方）
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    // 监听DataChannel创建
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };

    await this.pc.setRemoteDescription(offer);

    // 创建answer
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForIceGathering();

    this.emit('signal', {
      type: 'answer',
      sdp: this.pc.localDescription,
      from: this.config.deviceId,
      to: this.config.targetDeviceId,
    });
  }

  /**
   * 处理Answer（发起方）
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    
    // 添加之前收集的候选
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  /**
   * 处理ICE候选
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * 发送加密消息
   */
  async send(message: P2PMessage): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel未连接');
    }

    // 使用Signal Protocol加密
    const plaintext = JSON.stringify(message);
    const encrypted = await this.config.signalSession.encrypt(
      this.config.targetDeviceId,
      plaintext
    );

    message.encrypted = encrypted;

    this.dataChannel.send(JSON.stringify(message));
  }

  /**
   * 发送命令
   */
  async sendCommand(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      
      // 监听响应
      const handler = (response: P2PMessage) => {
        if (response.id === id && response.type === 'response') {
          this.off('message', handler);
          if (response.payload.error) {
            reject(new Error(response.payload.error));
          } else {
            resolve(response.payload.result);
          }
        }
      };

      this.on('message', handler);

      // 发送命令
      this.send({
        type: 'command',
        id,
        timestamp: Date.now(),
        payload: { type, data: payload },
      }).catch(reject);

      // 超时处理
      setTimeout(() => {
        this.off('message', handler);
        reject(new Error('命令执行超时'));
      }, 30000);
    });
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.dataChannel?.close();
    this.pc.close();
    this.connectionState = 'closed';
  }

  /**
   * 获取连接状态
   */
  getState(): RTCPeerConnectionState {
    return this.connectionState;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && 
           this.dataChannel?.readyState === 'open';
  }

  // ============ 私有方法 ============

  private setupPeerConnection(): void {
    // ICE候选收集
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          from: this.config.deviceId,
          to: this.config.targetDeviceId,
        });
      }
    };

    // 连接状态变化
    this.pc.onconnectionstatechange = () => {
      this.connectionState = this.pc.connectionState;
      this.emit('stateChange', this.connectionState);

      if (this.connectionState === 'connected') {
        this.emit('connected');
      } else if (this.connectionState === 'disconnected' || 
                 this.connectionState === 'failed') {
        this.emit('disconnected');
      }
    };

    // ICE连接状态
    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE状态:', this.pc.iceConnectionState);
    };
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('DataChannel已打开');
      this.emit('ready');
    };

    channel.onclose = () => {
      console.log('DataChannel已关闭');
      this.emit('closed');
    };

    channel.onerror = (error) => {
      console.error('DataChannel错误:', error);
      this.emit('error', error);
    };

    channel.onmessage = async (event) => {
      try {
        const message: P2PMessage = JSON.parse(event.data);
        
        // 解密消息
        if (message.encrypted) {
          const plaintext = await this.config.signalSession.decrypt(
            this.config.targetDeviceId,
            message.encrypted
          );
          message.payload = JSON.parse(plaintext);
          delete message.encrypted;
        }

        // 处理ping
        if (message.type === 'ping') {
          this.send({
            type: 'response',
            id: message.id,
            timestamp: Date.now(),
            payload: { type: 'pong' },
          });
          return;
        }

        this.emit('message', message);
      } catch (error) {
        console.error('消息解密失败:', error);
      }
    };
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.iceGatheringComplete) {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.iceGatheringComplete = true;
          resolve();
        }
      };

      this.pc.onicegatheringstatechange = checkState;
      
      // 超时处理（最多等待5秒）
      setTimeout(() => {
        resolve();
      }, 5000);
    });
  }
}

/**
 * P2P连接管理器
 */
export class P2PManager extends EventEmitter {
  private connections: Map<string, P2PConnection> = new Map();
  private signalSession: SignalSession;
  private deviceId: string;

  constructor(deviceId: string, signalSession: SignalSession) {
    super();
    this.deviceId = deviceId;
    this.signalSession = signalSession;
  }

  /**
   * 创建到某设备的P2P连接
   */
  async connect(targetDeviceId: string, isInitiator: boolean): Promise<P2PConnection> {
    // 检查是否已有连接
    if (this.connections.has(targetDeviceId)) {
      const existing = this.connections.get(targetDeviceId)!;
      if (existing.isConnected()) {
        return existing;
      }
      existing.close();
    }

    const connection = new P2PConnection({
      deviceId: this.deviceId,
      targetDeviceId,
      isInitiator,
      signalSession: this.signalSession,
    });

    // 转发信令消息
    connection.on('signal', (signal) => {
      this.emit('signal', signal);
    });

    connection.on('connected', () => {
      console.log(`✅ P2P连接建立: ${targetDeviceId}`);
      this.emit('deviceConnected', targetDeviceId);
    });

    connection.on('disconnected', () => {
      console.log(`❌ P2P连接断开: ${targetDeviceId}`);
      this.connections.delete(targetDeviceId);
      this.emit('deviceDisconnected', targetDeviceId);
    });

    this.connections.set(targetDeviceId, connection);
    
    await connection.initialize();
    
    return connection;
  }

  /**
   * 处理信令消息
   */
  async handleSignal(signal: any): Promise<void> {
    const { from, type } = signal;
    
    let connection = this.connections.get(from);
    
    if (!connection) {
      // 新连接
      if (type === 'offer') {
        connection = await this.connect(from, false);
      } else {
        console.warn('收到意外的信令消息:', signal);
        return;
      }
    }

    await connection.handleRemoteSignal(signal);
  }

  /**
   * 获取连接
   */
  getConnection(deviceId: string): P2PConnection | undefined {
    return this.connections.get(deviceId);
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    for (const [deviceId, connection] of this.connections) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * 获取所有连接状态
   */
  getAllStates(): Array<{ deviceId: string; state: string; connected: boolean }> {
    return Array.from(this.connections.entries()).map(([id, conn]) => ({
      deviceId: id,
      state: conn.getState(),
      connected: conn.isConnected(),
    }));
  }
}

export default P2PManager;
