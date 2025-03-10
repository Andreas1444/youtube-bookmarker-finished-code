function checkPhishingProbability(text, url) {
  return fetch('http://127.0.0.1:8000/predict', { 
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: text, url: url })
    
  })
  .then(response => response.json())
  .then(data => {
    return { 
      phishing_probability: data.phishing_probability,
      url_phishing_probability: data.url_phishing_probability 
    };
  })
  .catch(error => {
    console.error("Error fetching phishing probability:", error);
    return {phishing_probability: null, url_phishing_probability: null}; 
  });
}

function updateScanResult(text, url, sslValid, formDetails, linkCount, externalLinkCount, phishingProbability, urlPhishingProbability) {
  const scanResultElement = document.getElementById('scan-result');
  const probabilityText = document.getElementById('probability-text');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const probabilityTextURL = document.getElementById('url-probability-text');
  const progressBarFillURL = document.getElementById('progress-bar-fill2');
  document.getElementById('status').textContent = `${url}`;
  document.getElementById('text-content').textContent = text ? text.substring(0, 100) + "..." : "No content available";
  document.getElementById('ssl-valid').textContent = sslValid ? "Yes" : "No";
  document.getElementById('form-details-credit-card').textContent = (formDetails.isCreditCardField ? "❗Credit Card Information required" : "✅ No Credit Card information required");
  document.getElementById('form-details-password').textContent = (formDetails.isPasswordField ? "❗Password required" : "✅ No password required");
  document.getElementById('total-links').textContent = linkCount;
  document.getElementById('external-links').textContent = externalLinkCount;

  const probabilityPercentage = phishingProbability !== null ? (phishingProbability * 100).toFixed(2) : 0;
  const urlProbabilityPercentage = urlPhishingProbability !== null ? urlPhishingProbability.toFixed(2):0;

  probabilityText.textContent = `${probabilityPercentage}%`; 
  progressBarFill.style.width = `${probabilityPercentage}%`;

  probabilityTextURL.textContent = `${urlProbabilityPercentage}%`; 
  progressBarFillURL.style.width = `${urlProbabilityPercentage}%`;

  if (probabilityPercentage < 30) {
    progressBarFill.style.background = '#4ade80'; // Green
  } else if (probabilityPercentage < 70) {
    progressBarFill.style.background = '#facc15'; // Yellow
  } else {
    progressBarFill.style.background = '#f87171'; // Red
  }

  if (urlProbabilityPercentage < 30) {
    progressBarFillURL.style.background = '#4ade80'; // Green
  } else if (probabilityPercentage < 70) {
    progressBarFillURL.style.background = '#facc15'; // Yellow
  } else {
    progressBarFillURL.style.background = '#f87171'; // Red
  }
}


function checkSSLValidity(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return window.location.protocol === 'https:';  
      }
    }, (results) => {
      resolve(results[0]?.result ?? false);  
    });
  });
}

setTimeout(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const activeTab = tabs[0];
    const url = activeTab.url;
    const sslValid = await checkSSLValidity(activeTab.id);

    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        const forms = document.querySelectorAll('form');
        const formDetails = Array.from(forms).some(form => {
          return Array.from(form.querySelectorAll('input')).some(input => {
            const lowerName = input.name?.toLowerCase() || "";
            const lowerId = input.id?.toLowerCase() || "";
            const lowerPlaceholder = input.placeholder?.toLowerCase() || "";
        
            const isPasswordField = input.type === "password";
            const isCreditCardField = /credit|card|cvv|cvc|exp|expiry|security|ccn|ccv|holder/.test(lowerName + lowerId + lowerPlaceholder);
        
            return isPasswordField, isCreditCardField;
          });
        });
        const links = document.querySelectorAll('a');  
        const totalLinkCount = links.length;
        const currentDomain = window.location.hostname;
        const externalLinkCount = Array.from(links).filter(link => {
          try {
            const linkDomain = new URL(link.href).hostname;
            return linkDomain !== currentDomain;
          } catch (error) {
            return false; 
          }
        }).length;

        const textContent = document.body.innerText || null;
        return { textContent, formDetails, linkCount: totalLinkCount, externalLinkCount };
      }
    }, async (results) => {
      if (results && results[0] && results[0].result) {
        const { textContent, formDetails, linkCount, externalLinkCount } = results[0].result;
        const { phishing_probability,  url_phishing_probability } = await checkPhishingProbability(textContent, url);

    
        updateScanResult(textContent, url, sslValid, formDetails, linkCount, externalLinkCount, phishing_probability, url_phishing_probability);
      } else {
        console.error("Failed to retrieve page details.");
        updateScanResult(null, url, sslValid, null, 0, 0); 
      }
    });
  });
}, 2000);
