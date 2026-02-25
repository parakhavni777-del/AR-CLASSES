/**
 * Detect if running locally or on a web server
 * Adjusts base URL and handles local file:// protocol issues
 */
(function() {
    const isLocal = window.location.protocol === 'file:';
    const baseElement = document.querySelector('base');
    
    if (isLocal) {
        // Remove or empty the base href for local file access
        if (baseElement) {
            baseElement.href = '';
        }
        // Suppress manifest loading error in console for local testing
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            manifestLink.onerror = () => {
                console.warn('Manifest loading skipped in local mode (file://)');
            };
        }
    } else {
        // On web server, keep the base href for proper routing
        if (baseElement && !baseElement.href) {
            baseElement.href = '/AR-CLASSES/';
        }
    }
    
    // Expose environment info globally
    window.APP_ENV = {
        isLocal: isLocal,
        isDev: isLocal,
        isProduction: !isLocal,
        basePath: isLocal ? '' : '/AR-CLASSES/',
        assetPath: isLocal ? 'assets' : 'assets'
    };
    
    console.log('App Environment:', window.APP_ENV);
})();
