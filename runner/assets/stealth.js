(function() {
    'use strict';

    // ---- navigator.webdriver (harder kill) ----
    try {
        const proto = Navigator.prototype;
        Object.defineProperty(proto, 'webdriver', {
            get: () => undefined,
            configurable: true,
        });
    } catch(e) {}
    try {
        delete Navigator.prototype.webdriver;
    } catch(e) {}
    try {
        delete window.navigator.webdriver;
    } catch(e) {}
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.plugins (realistic length) ----
    try {
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ],
            configurable: true,
        });
    } catch(e) {}
    try {
        Object.defineProperty(PluginsArray.prototype, 'length', {
            get: () => 3,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.languages ----
    try {
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.hardwareConcurrency (4 or 8) ----
    try {
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => Math.random() < 0.3 ? 4 : 8,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.deviceMemory (4 or 8) ----
    try {
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => Math.random() < 0.4 ? 4 : 8,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.maxTouchPoints ----
    try {
        Object.defineProperty(navigator, 'maxTouchPoints', {
            get: () => 0,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.pdfViewerEnabled ----
    try {
        Object.defineProperty(navigator, 'pdfViewerEnabled', {
            get: () => true,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.cookieEnabled ----
    try {
        Object.defineProperty(navigator, 'cookieEnabled', {
            get: () => true,
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.vendor ----
    try {
        Object.defineProperty(navigator, 'vendor', {
            get: () => 'Google Inc.',
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.connection (randomized) ----
    try {
        const types = ['4g', '3g', '4g', '4g', 'wifi', 'ethernet'];
        const rtts = [20, 30, 50, 80, 100, 150];
        const downlinks = [5, 10, 10, 20, 30, 50];
        Object.defineProperty(navigator, 'connection', {
            get: () => ({
                effectiveType: types[Math.floor(Math.random() * types.length)],
                rtt: rtts[Math.floor(Math.random() * rtts.length)],
                downlink: downlinks[Math.floor(Math.random() * downlinks.length)],
                downlinkMax: Infinity,
                saveData: false,
                type: 'wifi',
                onchange: null,
                addEventListener: function() {},
                removeEventListener: function() {},
            }),
            configurable: true,
        });
    } catch(e) {}

    // ---- chrome.* (app, webstore, runtime, csi, loadTimes) ----
    if (window.chrome) {
        try {
            window.chrome.runtime = {
                id: undefined,
                onInstalled: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onMessage: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onConnect: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onStartup: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onSuspend: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onSuspendCanceled: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onUpdateAvailable: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                onBrowserUpdateAvailable: { addListener: function() {}, removeListener: function() {}, hasListener: function() {} },
                sendMessage: function() {},
                connect: function() { return { onMessage: { addListener: function() {} } }; },
                getManifest: function() { return {}; },
                getURL: function(p) { return p; },
            };
        } catch(e) {}
        try {
            window.chrome.app = {
                isInstalled: false,
                getDetails: function() { return null; },
                getIsInstalled: function() {},
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            };
        } catch(e) {}
        try {
            window.chrome.webstore = {
                onInstallStageChanged: { addListener: function() {}, removeListener: function() {} },
                onDownloadProgress: { addListener: function() {}, removeListener: function() {} },
            };
        } catch(e) {}
        try {
            window.chrome.loadTimes = function() {
                return {
                    requestTime: 0,
                    startLoadTime: 0,
                    commitLoadTime: 0,
                    finishDocumentLoadTime: 0,
                    finishLoadTime: 0,
                    firstPaintTime: 0,
                    firstPaintAfterLoadTime: 0,
                    navigationType: 'Reload',
                    wasFetchedViaSpdy: false,
                    wasNpnNegotiated: false,
                    npnNegotiatedProtocol: '',
                    wasAlternateProtocolAvailable: false,
                    connectionInfo: 'http/1.1',
                };
            };
        } catch(e) {}
        try {
            window.chrome.csi = function() {
                return { onloadT: Math.floor(Math.random() * 500), startE: 0, onload: Math.floor(Math.random() * 500) };
            };
        } catch(e) {}
    }

    // ---- navigator.credentials ----
    try {
        Object.defineProperty(navigator, 'credentials', {
            get: () => ({
                create: function() { return Promise.resolve(null); },
                get: function() { return Promise.resolve(null); },
                preventSilentAccess: function() { return Promise.resolve(); },
                store: function() { return Promise.resolve(); },
            }),
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.permissions ----
    try {
        Object.defineProperty(navigator, 'permissions', {
            get: () => ({
                query: function(params) {
                    const denied = new Set(['geolocation', 'notifications', 'microphone', 'camera']);
                    const state = params && denied.has(params.name) ? 'prompt' : 'granted';
                    return Promise.resolve({ state: state, onchange: null });
                },
            }),
            configurable: true,
        });
    } catch(e) {}

    // ---- navigator.mediaDevices ----
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const origEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
            navigator.mediaDevices.enumerateDevices = function() {
                return origEnum().then(function(devices) {
                    if (devices.length === 0) {
                        return [
                            { deviceId: 'default', kind: 'audioinput', label: 'Internal Microphone', groupId: 'default' },
                            { deviceId: 'default', kind: 'audiooutput', label: 'Internal Speakers', groupId: 'default' },
                            { deviceId: 'default', kind: 'videoinput', label: 'HD Webcam', groupId: 'default' },
                        ];
                    }
                    return devices;
                });
            };
        }
    } catch(e) {}

    // ---- navigator.getBattery ----
    try {
        navigator.getBattery = function() {
            return Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1.0,
                onchargingchange: null,
                onchargingtimechange: null,
                ondischargingtimechange: null,
                onlevelchange: null,
                addEventListener: function() {},
                removeEventListener: function() {},
            });
        };
    } catch(e) {}

    // ---- screen ----
    try {
        Object.defineProperty(screen, 'colorDepth', { get: () => 24, configurable: true });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24, configurable: true });
        Object.defineProperty(screen, 'availWidth', { get: () => screen.width || 1920, configurable: true });
        Object.defineProperty(screen, 'availHeight', { get: () => (screen.height || 1080) - 40, configurable: true });
        Object.defineProperty(screen, 'availLeft', { get: () => 0, configurable: true });
        Object.defineProperty(screen, 'availTop', { get: () => 0, configurable: true });
    } catch(e) {}

    try {
        Object.defineProperty(window, 'screenX', { get: () => Math.floor(Math.random() * 50), configurable: true });
        Object.defineProperty(window, 'screenY', { get: () => Math.floor(Math.random() * 50) + 20, configurable: true });
        Object.defineProperty(window, 'screenLeft', { get: () => window.screenX, configurable: true });
        Object.defineProperty(window, 'screenTop', { get: () => window.screenY, configurable: true });
        Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth || 1920, configurable: true });
        Object.defineProperty(window, 'outerHeight', { get: () => (window.innerHeight || 1080) + 40, configurable: true });
    } catch(e) {}

    // ---- WebGL ----
    try {
        const origGetParam = WebGLRenderingContext.prototype.getParameter;
        if (origGetParam) {
            const gpuVendors = ['Google Inc.', 'Intel Inc.', 'NVIDIA Corporation'];
            const gpuRenderer = [
                'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (Intel, Intel(R) Iris(TM) Graphics Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (NVIDIA, GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)',
                'ANGLE (NVIDIA, GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
            ];
            const vendor = gpuVendors[Math.floor(Math.random() * gpuVendors.length)];
            const renderer = gpuRenderer[Math.floor(Math.random() * gpuRenderer.length)];
            WebGLRenderingContext.prototype.getParameter = function(param) {
                if (param === 37445) return vendor;
                if (param === 37446) return renderer;
                if (param === 3415) return 24;
                if (param === 3414) return 8;
                if (param === 36348) return 30;
                if (param === 7936) return 'WebGL GLSL ES';
                if (param === 7937) return 'OpenGL ES GLSL ES 1.0 (ANGLE)';
                if (param === 37444) return 'WebGL';
                return origGetParam.call(this, param);
            };
        }
    } catch(e) {}

    // ---- canvas fingerprint noise ----
    try {
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
            const canvas = this;
            if (canvas.width === 0 || canvas.height === 0) return origToDataURL.call(canvas, type, quality);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (imageData) {
                    const pixels = imageData.data;
                    const noise = Math.floor(Math.random() * 3) + 1;
                    for (let i = 0; i < noise; i++) {
                        const idx = Math.floor(Math.random() * pixels.length);
                        pixels[idx] = Math.min(255, pixels[idx] + 1);
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
            }
            return origToDataURL.call(canvas, type, quality);
        };
    } catch(e) {}

    // ---- AudioContext fingerprint noise ----
    try {
        const origGetByteFreq = AnalyserNode.prototype.getByteFrequencyData;
        AnalyserNode.prototype.getByteFrequencyData = function(array) {
            origGetByteFreq.call(this, array);
            if (array && array.length > 0) {
                array[0] = Math.min(255, array[0] + Math.floor(Math.random() * 5));
            }
        };
    } catch(e) {}

    // ---- iframe injection ----
    function injectIntoFrames() {
        try {
            const frames = document.querySelectorAll('iframe');
            for (const frame of frames) {
                try {
                    const doc = frame.contentDocument || frame.contentWindow.document;
                    if (doc && doc.readyState === 'complete' && !doc.querySelector('[data-stealth-injected]')) {
                        const s = doc.createElement('script');
                        s.setAttribute('data-stealth-injected', '1');
                        s.textContent = '(' + arguments.callee.toString() + ')();';
                        doc.documentElement.appendChild(s);
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }

    try {
        const observer = new MutationObserver(function() { injectIntoFrames(); });
        observer.observe(document, { childList: true, subtree: true });
        injectIntoFrames();
    } catch(e) {}

    try {
        const m = document.createElement('meta');
        m.name = 'stealth-injected';
        document.documentElement.appendChild(m);
    } catch(e) {}
})();
