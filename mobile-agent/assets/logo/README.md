# App Logo 配置指南

## 📁 图标文件位置

所有图标已生成在 `assets/logo/` 目录：

```
assets/logo/
├── logo-original.png    # 原始高清图
├── icon-1024.png        # App Store (1024x1024)
├── icon-512.png         # 备用
├── icon-192.png         # Android xxxhdpi
├── icon-144.png         # Android xxhdpi
├── icon-96.png          # Android xhdpi
├── icon-72.png          # Android hdpi
└── icon-48.png          # Android mdpi
```

## 🤖 Android 配置

### 1. 复制图标
```bash
# 在项目根目录执行
cp assets/logo/icon-48.png android/app/src/main/res/mipmap-mdpi/ic_launcher.png
cp assets/logo/icon-72.png android/app/src/main/res/mipmap-hdpi/ic_launcher.png
cp assets/logo/icon-96.png android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
cp assets/logo/icon-144.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
cp assets/logo/icon-192.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

### 2. 设置应用名称
编辑 `android/app/src/main/res/values/strings.xml`：
```xml
<resources>
    <string name="app_name">智能设备助手</string>
</resources>
```

### 3. 圆形图标（可选）
如需圆形图标，复制到 `mipmap-*dpi/ic_launcher_round.png`

## 🍎 iOS 配置

### 1. 初始化 iOS 项目（如未初始化）
```bash
cd ios && pod install
```

### 2. 使用 Xcode 设置图标
1. 打开 `ios/MobileAgent.xcworkspace`
2. 选择项目 → Targets → MobileAgent → General → App Icons
3. 拖入对应尺寸的图标

### 3. 或使用命令行配置
创建目录并复制图标：
```bash
mkdir -p ios/MobileAgent/Images.xcassets/AppIcon.appiconset
cp assets/logo/icon-1024.png ios/MobileAgent/Images.xcassets/AppIcon.appiconset/ItunesArtwork@2x.png
# 其他尺寸...
```

创建 `Contents.json`：
```json
{
  "images": [
    {"size":"20x20", "idiom":"iphone", "filename":"icon-20@2x.png", "scale":"2x"},
    {"size":"20x20", "idiom":"iphone", "filename":"icon-20@3x.png", "scale":"3x"},
    {"size":"29x29", "idiom":"iphone", "filename":"icon-29@2x.png", "scale":"2x"},
    {"size":"29x29", "idiom":"iphone", "filename":"icon-29@3x.png", "scale":"3x"},
    {"size":"40x40", "idiom":"iphone", "filename":"icon-40@2x.png", "scale":"2x"},
    {"size":"40x40", "idiom":"iphone", "filename":"icon-40@3x.png", "scale":"3x"},
    {"size":"60x60", "idiom":"iphone", "filename":"icon-60@2x.png", "scale":"2x"},
    {"size":"60x60", "idiom":"iphone", "filename":"icon-60@3x.png", "scale":"3x"},
    {"size":"1024x1024", "idiom":"ios-marketing", "filename":"icon-1024.png", "scale":"1x"}
  ],
  "info": {"version":1, "author":"xcode"}
}
```

## 🎨 应用内使用 Logo

在 React Native 中使用：
```javascript
import { Image } from 'react-native';

<Image 
  source={require('./assets/logo/logo-original.png')} 
  style={{ width: 100, height: 100 }}
/>
```

## ✅ 提交到 Git

```bash
git add assets/logo/
git commit -m "添加应用图标"
git push
```
