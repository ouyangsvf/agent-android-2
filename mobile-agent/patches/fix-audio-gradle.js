// patches/react-native-audio+4.3.0.patch
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '../node_modules/react-native-audio/android/build.gradle');

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // 替换旧的 compile 为 implementation
  content = content.replace(/compile\s+/g, 'implementation ');
  content = content.replace(/compile\(/g, 'implementation(');
  
  fs.writeFileSync(buildGradlePath, content);
  console.log('✅ Patched react-native-audio build.gradle');
} else {
  console.log('⚠️ react-native-audio build.gradle not found');
}
