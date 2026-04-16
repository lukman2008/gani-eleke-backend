const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Checking Chrome installation...');

// For Render.com production
if (process.env.NODE_ENV === 'production') {
    console.log('Production environment - Chrome will be provided by Render buildpack');
    process.exit(0);
}

// For local development on Windows
if (os.platform() === 'win32') {
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    let found = false;
    for (const chromePath of chromePaths) {
        if (fs.existsSync(chromePath)) {
            console.log(`✅ Chrome found at: ${chromePath}`);
            found = true;
            break;
        }
    }
    
    if (!found) {
        console.log('⚠️ Chrome not found locally. Install Chrome for better performance.');
    }
}