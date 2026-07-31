/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Central API Module (app/api.js)
   ════════════════════════════════════════════════════════════════ */

const API_URL = "https://script.google.com/macros/s/AKfycbxbYUKZYwYRssm80AnP8kDj-8_ymsaFczKmecbchEntyhhr5-zqAIDYov-Nt7Ko0pDOMA/exec";

/**
 * Sends a POST payload to Google Apps Script.
 * Uses 'text/plain' content-type to avoid CORS preflight triggers in Apps Script.
 * 
 * @param {Object} data - Payload containing action name & arguments
 * @returns {Promise<Object>} - Server response object
 */
async function apiFetch(data) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return { ok: false, msg: "Network connection error. Please try again." };
  }
}

/* ════════ HELPER FUNCTIONS ════════ */

// Retrieve currently logged-in user session
function getSessionUser() {
  const user = localStorage.getItem("keytube_user");
  return user ? JSON.parse(user) : null;
}

// Store user session in localStorage
function setSessionUser(user) {
  localStorage.setItem("keytube_user", JSON.stringify(user));
}

// Clear user session data on sign out
function clearSession() {
  localStorage.removeItem("keytube_user");
  localStorage.removeItem("keytube_admin_token");
}

// Display UI notification banner
function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) {
    alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}
