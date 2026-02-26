#!/usr/bin/env node
/**
 * 全面修复有问题的依赖
 */

const fs = require('fs');
const path = require('path');

const patches = [
  // react-native-audio
  {
    file: 'node_modules/react-native-audio/android/build.gradle',
    fixes: [
      [/compile\s+/g, 'implementation '],
      [/compile\(/g, 'implementation('],
    ]
  },
  // react-native-background-job
  {
    file: 'node_modules/react-native-background-job/android/build.gradle',
    fixes: [
      [/compile\s+/g, 'implementation '],
      [/compile\(/g, 'implementation('],
      [/'com\.android\.tools\.build:gradle:2\.3\.2'/, "'com.android.tools.build:gradle:7.3.1'"],
      [/jcenter\(\)/g, 'mavenCentral()'],
      [/'https:\/\/maven\.google\.com'/, "'https://maven.google.com'"],
    ]
  },
  // react-native-system-setting
  {
    file: 'node_modules/react-native-system-setting/android/build.gradle',
    fixes: [
      [/compile\s+/g, 'implementation '],
      [/compileSdkVersion 26/, 'compileSdkVersion 33'],
      [/buildToolsVersion "26\.0\.3"/, 'buildToolsVersion "33.0.0"'],
      [/targetSdkVersion 26/, 'targetSdkVersion 33'],
    ]
  },
];

patches.forEach(patch => {
  const filePath = path.join(__dirname, '..', patch.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    patch.fixes.forEach(([regex, replacement]) => {
      const newContent = content.replace(regex, replacement);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Patched ${patch.file}`);
    }
  } else {
    console.log(`⚠️ Not found: ${patch.file}`);
  }
});

console.log('🎉 All patches applied!');
