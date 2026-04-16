const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const CHROME_VERSION = '120.0.6099.109';
const platform = os.platform();

async function downloadChrome() {
    console.log('Downloading Chrome for Puppeteer...');
    
    let url;
    if (platform === 'win32') {
        url = `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Win_x64%2F${CHROME_VERSION}%2Fchrome-win32.zip?alt=media`;
    } else if (platform === 'linux') {
        url = `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Linux_x64%2F${CHROME_VERSION}%2Fchrome-linux.zip?alt=media`;
    } else {
        console.log('Platform not supported for automatic download');
        return;
    }
    
    console.log('Chrome will be provided by Render buildpack in production');
}

// Only run in production on Render
if (process.env.NODE_ENV === 'production') {
    console.log('Production environment - waiting for Render buildpack Chrome');
} else {
    console.log('Development environment - using local Chrome');
}

module.exports = downloadChrome;