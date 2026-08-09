// ads
    (function() {
        const adUrls = [
            "https://omg10.com/4/11024124",
            "https://omg10.com/4/11024393"
        ];

        let clickCount = parseInt(localStorage.getItem('globalClickCount')) || 0;
        console.log("Ad script loaded. Current click count:", clickCount);

        document.addEventListener('click', function(event) {
            clickCount++;
            localStorage.setItem('globalClickCount', clickCount);
            console.log("Click registered! Total clicks:", clickCount);

            // Check if click count is a multiple of 10 (10, 20, 30, etc.)
            if (clickCount % 10 === 0) {
                const urlIndex = Math.floor((clickCount / 10) - 1) % adUrls.length;
                const targetUrl = adUrls[urlIndex];
                console.log("Target reached (10th click). Opening:", targetUrl);

                // Attempt to open in a new tab
                let openedWindow = window.open(targetUrl, '_blank');
                
                // If the browser blocks the popup, fall back to redirecting the current page