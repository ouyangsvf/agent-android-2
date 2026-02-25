/**
 * Signal Protocol (Double Ratchet Algorithm) 实现
 * 端到端加密核心
 */

import * as crypto from 'crypto';

// 使用 Web Crypto API 或 Node.js crypto
const subtle = typeof window !== 'undefined' 
  ? window.crypto.subtle 
  : crypto.webcrypto.subtle;

// Signal Protocol 常量
const SIGNAL_CONSTANTS = {
  ROOT_CHAIN_KEY_SIZE: 32,
  MESSAGE_KEY_SIZE: 32,
  IV_SIZE: 16,
  DH_KEY_SIZE: 32,
  MAX_SKIP: 100,  // 最大跳过的消息数
};

/**
 * 密钥工具类
 */
export class CryptoUtils {
  /**
   * 生成X25519密钥对
   */
  static async generateX25519KeyPair(): Promise<CryptoKeyPair> {
    return subtle.generateKey(
      { name: 'X25519' },
      true,  // 可导出
      ['deriveBits', 'deriveKey']
    );
  }

  /**
   * X3DH密钥交换
   * 用于初始握手建立共享密钥
   */
  static async x3dh(
    identityKey: CryptoKey,
    ephemeralKey: CryptoKeyPair,
    recipientIdentityKey: CryptoKey,
    recipientSignedPreKey: CryptoKey,
    recipientOneTimePreKey?: CryptoKey
  ): Promise<ArrayBuffer> {
    const dh1 = await this.deriveDH(identityKey, recipientSignedPreKey);
    const dh2 = await this.deriveDH(ephemeralKey.privateKey, recipientIdentityKey);
    const dh3 = await this.deriveDH(ephemeralKey.privateKey, recipientSignedPreKey);
    
    let sharedSecrets = [dh1, dh2, dh3];
    
    if (recipientOneTimePreKey) {
      const dh4 = await this.deriveDH(ephemeralKey.privateKey, recipientOneTimePreKey);
      sharedSecrets.push(dh4);
    }

    // KDF混合
    const combined = await this.concatArrayBuffers(...sharedSecrets);
    return this.hkdf(combined, new Uint8Array(32), 'X3DH');
  }

  /**
   * DH密钥派生
   */
  private static async deriveDH(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
    return subtle.deriveBits(
      { name: 'X25519', public: publicKey },
      privateKey,
      256
    );
  }

  /**
   * HKDF密钥派生
   */
  static async hkdf(
    inputKeyMaterial: ArrayBuffer,
    salt: Uint8Array,
    info: string
  ): Promise<ArrayBuffer> {
    // 简化实现，实际使用标准HKDF
    const encoder = new TextEncoder();
    const infoBuffer = encoder.encode(info);
    
    const extractKey = await subtle.importKey(
      'raw',
      inputKeyMaterial,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    return subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: infoBuffer,
      },
      extractKey,
      256
    );
  }

  /**
   * AES-256-GCM加密
   */
  static async encrypt(
    plaintext: Uint8Array,
    key: ArrayBuffer,
    iv: Uint8Array
  ): Promise<{ ciphertext: ArrayBuffer; tag: ArrayBuffer }> {
    const cryptoKey = await subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      plaintext
    );

    // 分离密文和认证标签
    const encrypted = new Uint8Array(ciphertext);
    const tagStart = encrypted.length - 16;
    
    return {
      ciphertext: encrypted.slice(0, tagStart).buffer,
      tag: encrypted.slice(tagStart).buffer,
    };
  }

  /**
   * AES-256-GCM解密
   */
  static async decrypt(
    ciphertext: ArrayBuffer,
    key: ArrayBuffer,
    iv: Uint8Array,
    tag: ArrayBuffer
  ): Promise<ArrayBuffer> {
    // 合并密文和tag
    const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    combined.set(new Uint8Array(ciphertext), 0);
    combined.set(new Uint8Array(tag), ciphertext.byteLength);

    const cryptoKey = await subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    return subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      combined
    );
  }

  /**
   * 连接多个ArrayBuffer
   */
  private static async concatArrayBuffers(...buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    
    return result.buffer;
  }
}

/**
 * Double Ratchet会话状态
 */
interface RatchetState {
  // DH Ratchet
  rootKey: ArrayBuffer;
  sendingChainKey?: ArrayBuffer;
  receivingChainKey?: ArrayBuffer;
  
  // DH密钥
  ourIdentityKey: CryptoKeyPair;
  ourRatchetKey?: CryptoKeyPair;  // 当前DH密钥对
  theirIdentityKey?: CryptoKey;
  theirRatchetPublicKey?: CryptoKey;
  
  // 消息序号
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  
  // 跳过的消息密钥（用于乱序消息）
  skippedMessageKeys: Map<string, ArrayBuffer>;
}

/**
 * Double Ratchet实现
 */
export class DoubleRatchet {
  private state: RatchetState;
  private maxSkip: number = SIGNAL_CONSTANTS.MAX_SKIP;

  constructor(initialRootKey: ArrayBuffer, ourIdentityKey: CryptoKeyPair) {
    this.state = {
      rootKey: initialRootKey,
      ourIdentityKey,
      sendingMessageNumber: 0,
      receivingMessageNumber: 0,
      skippedMessageKeys: new Map(),
    };
  }

  /**
   * 初始化发送方
   */
  static async initializeSender(
    sharedSecret: ArrayBuffer,
    ourIdentityKey: CryptoKeyPair,
    theirRatchetPublicKey: CryptoKey
  ): Promise<DoubleRatchet> {
    const ratchet = new DoubleRatchet(sharedSecret, ourIdentityKey);
    ratchet.state.theirRatchetPublicKey = theirRatchetPublicKey;
    
    // 生成第一个DH密钥对
    ratchet.state.ourRatchetKey = await CryptoUtils.generateX25519KeyPair();
    
    // 执行第一次DH ratchet
    await ratchet.performDHRatchetStep();
    
    return ratchet;
  }

  /**
   * 初始化接收方
   */
  static async initializeReceiver(
    sharedSecret: ArrayBuffer,
    ourIdentityKey: CryptoKeyPair,
    ourRatchetKey: CryptoKeyPair
  ): Promise<DoubleRatchet> {
    const ratchet = new DoubleRatchet(sharedSecret, ourIdentityKey);
    ratchet.state.ourRatchetKey = ourRatchetKey;
    return ratchet;
  }

  /**
   * 加密消息
   */
  async encrypt(plaintext: Uint8Array): Promise<EncryptedMessage> {
    // 检查是否需要DH ratchet
    if (!this.state.sendingChainKey) {
      await this.performDHRatchetStep();
    }

    // 派生消息密钥
    const { messageKey, nextChainKey } = await this.kdfMessageKey(
      this.state.sendingChainKey!
    );
    
    this.state.sendingChainKey = nextChainKey;
    this.state.sendingMessageNumber++;

    // 生成随机IV
    const iv = crypto.randomBytes(SIGNAL_CONSTANTS.IV_SIZE);

    // 加密
    const { ciphertext, tag } = await CryptoUtils.encrypt(
      plaintext,
      messageKey,
      iv
    );

    return {
      header: {
        dhPublicKey: await this.exportPublicKey(this.state.ourRatchetKey!.publicKey),
        messageNumber: this.state.sendingMessageNumber - 1,
        previousChainLength: 0, // 简化处理
      },
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      tag: Buffer.from(tag).toString('base64'),
    };
  }

  /**
   * 解密消息
   */
  async decrypt(message: EncryptedMessage): Promise<Uint8Array> {
    const header = message.header;

    // 检查是否需要DH ratchet
    if (header.dhPublicKey !== await this.exportPublicKey(this.state.theirRatchetPublicKey)) {
      await this.performDHRatchetStep(header.dhPublicKey);
    }

    // 检查是否是跳过的消息
    const skippedKey = this.state.skippedMessageKeys.get(
      `${header.messageNumber}`
    );
    
    let messageKey: ArrayBuffer;
    
    if (skippedKey) {
      messageKey = skippedKey;
      this.state.skippedMessageKeys.delete(`${header.messageNumber}`);
    } else {
      // 正常解密流程
      const result = await this.kdfMessageKey(this.state.receivingChainKey!);
      messageKey = result.messageKey;
      this.state.receivingChainKey = result.nextChainKey;
      this.state.receivingMessageNumber++;
    }

    // 解密
    const plaintext = await CryptoUtils.decrypt(
      Buffer.from(message.ciphertext, 'base64'),
      messageKey,
      Buffer.from(message.iv, 'base64'),
      Buffer.from(message.tag, 'base64')
    );

    return new Uint8Array(plaintext);
  }

  /**
   * 执行DH Ratchet步骤
   */
  private async performDHRatchetStep(theirNewPublicKey?: string): Promise<void> {
    if (theirNewPublicKey) {
      // 收到新的DH公钥，更新状态
      this.state.theirRatchetPublicKey = await this.importPublicKey(theirNewPublicKey);
      
      // DH计算
      const dhOutput = await CryptoUtils.deriveDH(
        this.state.ourRatchetKey!.privateKey,
        this.state.theirRatchetPublicKey
      );

      // KDF派生新密钥
      const newRootKey = await CryptoUtils.hkdf(
        dhOutput,
        new Uint8Array(this.state.rootKey),
        'ratchet'
      );

      this.state.rootKey = newRootKey;
      
      // 生成新的DH密钥对
      this.state.ourRatchetKey = await CryptoUtils.generateX25519KeyPair();
      
      // 派生接收链密钥
      const receivingKeys = await this.kdfRatchetKeys(newRootKey);
      this.state.receivingChainKey = receivingKeys.chainKey;
    } else {
      // 首次初始化，派生发送链密钥
      const sendingKeys = await this.kdfRatchetKeys(this.state.rootKey);
      this.state.sendingChainKey = sendingKeys.chainKey;
    }
  }

  /**
   * KDF派生Ratchet密钥
   */
  private async kdfRatchetKeys(rootKey: ArrayBuffer): Promise<{
    chainKey: ArrayBuffer;
    nextHeaderKey: ArrayBuffer;
  }> {
    const keys = await CryptoUtils.hkdf(
      rootKey,
      new Uint8Array(32),
      'DoubleRatchetKeys'
    );

    // 前32字节作为chain key，后32字节作为next header key
    const keysArray = new Uint8Array(keys);
    return {
      chainKey: keysArray.slice(0, 32).buffer,
      nextHeaderKey: keysArray.slice(32, 64).buffer,
    };
  }

  /**
   * KDF派生消息密钥
   */
  private async kdfMessageKey(chainKey: ArrayBuffer): Promise<{
    messageKey: ArrayBuffer;
    nextChainKey: ArrayBuffer;
  }> {
    const encoder = new TextEncoder();
    const messageKey = await CryptoUtils.hkdf(
      chainKey,
      encoder.encode('MessageKey'),
      ''
    );
    
    const nextChainKey = await CryptoUtils.hkdf(
      chainKey,
      encoder.encode('ChainKey'),
      ''
    );

    return { messageKey, nextChainKey };
  }

  /**
   * 导出公钥
   */
  private async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await subtle.exportKey('raw', key);
    return Buffer.from(exported).toString('base64');
  }

  /**
   * 导入公钥
   */
  private async importPublicKey(keyData: string): Promise<CryptoKey> {
    const buffer = Buffer.from(keyData, 'base64');
    return subtle.importKey(
      'raw',
      buffer,
      { name: 'X25519' },
      true,
      []
    );
  }
}

/**
 * 加密消息格式
 */
export interface EncryptedMessage {
  header: {
    dhPublicKey: string;  // Base64编码的X25519公钥
    messageNumber: number;
    previousChainLength: number;
  };
  ciphertext: string;  // Base64
  iv: string;          // Base64
  tag: string;         // Base64 (GCM认证标签)
}

/**
 * Signal Protocol会话管理
 */
export class SignalSession {
  private identityKeyPair: CryptoKeyPair;
  private preKeys: Map<number, CryptoKeyPair>;
  private signedPreKey: CryptoKeyPair;
  private sessions: Map<string, DoubleRatchet> = new Map();

  constructor() {
    this.preKeys = new Map();
  }

  /**
   * 初始化身份密钥
   */
  async initialize(): Promise<void> {
    this.identityKeyPair = await CryptoUtils.generateX25519KeyPair();
    
    // 生成签名预密钥
    this.signedPreKey = await CryptoUtils.generateX25519KeyPair();
    
    // 生成一批一次性预密钥
    for (let i = 0; i < 100; i++) {
      this.preKeys.set(i, await CryptoUtils.generateX25519KeyPair());
    }
  }

  /**
   * 获取公钥包（用于初始握手）
   */
  async getPublicKeyBundle(): Promise<PublicKeyBundle> {
    return {
      identityKey: await this.exportPublicKey(this.identityKeyPair.publicKey),
      signedPreKey: await this.exportPublicKey(this.signedPreKey.publicKey),
      signedPreKeySignature: await this.signPreKey(),
      oneTimePreKeys: await Promise.all(
        Array.from(this.preKeys.values()).slice(0, 10).map(async (kp) =>
          this.exportPublicKey(kp.publicKey)
        )
      ),
    };
  }

  /**
   * 建立与某设备的会话
   */
  async establishSession(
    deviceId: string,
    theirBundle: PublicKeyBundle
  ): Promise<void> {
    // X3DH握手
    const ephemeralKey = await CryptoUtils.generateX25519KeyPair();
    
    const sharedSecret = await CryptoUtils.x3dh(
      this.identityKeyPair.privateKey,
      ephemeralKey,
      await this.importPublicKey(theirBundle.identityKey),
      await this.importPublicKey(theirBundle.signedPreKey),
      theirBundle.oneTimePreKeys[0] 
        ? await this.importPublicKey(theirBundle.oneTimePreKeys[0])
        : undefined
    );

    // 初始化Double Ratchet
    const session = await DoubleRatchet.initializeSender(
      sharedSecret,
      this.identityKeyPair,
      await this.importPublicKey(theirBundle.signedPreKey)
    );

    this.sessions.set(deviceId, session);
  }

  /**
   * 加密给某设备的消息
   */
  async encrypt(deviceId: string, plaintext: string): Promise<EncryptedMessage> {
    const session = this.sessions.get(deviceId);
    if (!session) {
      throw new Error(`未建立与设备 ${deviceId} 的会话`);
    }

    const encoder = new TextEncoder();
    return session.encrypt(encoder.encode(plaintext));
  }

  /**
   * 解密来自某设备的消息
   */
  async decrypt(deviceId: string, message: EncryptedMessage): Promise<string> {
    let session = this.sessions.get(deviceId);
    
    if (!session) {
      // 首次接收，初始化接收方会话
      // 简化处理，实际需要X3DH响应
      throw new Error('需要先建立会话');
    }

    const plaintext = await session.decrypt(message);
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  }

  // 辅助方法省略...
  private async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await subtle.exportKey('raw', key);
    return Buffer.from(exported).toString('base64');
  }

  private async importPublicKey(keyData: string): Promise<CryptoKey> {
    const buffer = Buffer.from(keyData, 'base64');
    return subtle.importKey('raw', buffer, { name: 'X25519' }, true, []);
  }

  private async signPreKey(): Promise<string> {
    // 使用身份密钥签名预密钥
    // 简化实现
    return 'signature-placeholder';
  }
}

/**
 * 公钥包
 */
export interface PublicKeyBundle {
  identityKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: string[];
}

export default SignalSession;
