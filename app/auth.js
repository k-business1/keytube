/* ════════════════════════════════════════════════════════════════
   KEYTUBE — Authentication Module (app/auth.js)
   ════════════════════════════════════════════════════════════════ */

/**
 * Authenticate a standard user via Gmail & Password
 * @param {string} gmail 
 * @param {string} password 
 */
async function doLogin(gmail, password) {
  if (!gmail || !password) {
    showToast("Please enter both email and password.", "error");
    return { ok: false, msg: "Missing fields" };
  }

  const res = await apiFetch({
    action: "login",
    gmail: gmail.trim(),
    password: password
  });

  if (res.ok) {
    setSessionUser(res.user);
    showToast("Login successful!", "success");
    
    // Redirect to index or main page after successful login
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1000);
  } else {
    showToast(res.msg || "Invalid credentials.", "error");
  }

  return res;
}

/**
 * Register a new user account
 * @param {string} name 
 * @param {string} gmail 
 * @param {string} password 
 * @param {string} country 
 * @param {string} avatar 
 */
async function doRegister(name, gmail, password, country = "", avatar = "") {
  if (!name || !gmail || !password) {
    showToast("Please fill in all required fields.", "error");
    return { ok: false, msg: "Missing fields" };
  }

  if (!gmail.toLowerCase().endsWith("@gmail.com")) {
    showToast("Only @gmail.com addresses are supported.", "error");
    return { ok: false, msg: "Invalid Gmail" };
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters long.", "error");
    return { ok: false, msg: "Short password" };
  }

  const res = await apiFetch({
    action: "register",
    name: name.trim(),
    gmail: gmail.trim(),
    password: password,
    country: country,
    avatar: avatar
  });

  if (res.ok) {
    setSessionUser(res.user);
    showToast("Account created successfully!", "success");
    
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 1000);
  } else {
    showToast(res.msg || "Registration failed.", "error");
  }

  return res;
}

/**
 * Update current user profile or password
 * @param {Object} updateData - Object containing fields like name, country, avatar, password, newPassword
 */
async function updateUserProfile(updateData) {
  const user = getSessionUser();
  if (!user) {
    showToast("You must be logged in to update your profile.", "error");
    return { ok: false, msg: "Not authenticated" };
  }

  const res = await apiFetch({
    action: "updateUserProfile",
    gmail: user.gmail,
    ...updateData
  });

  if (res.ok) {
    setSessionUser(res.user);
    showToast(res.msg || "Profile updated!", "success");
  } else {
    showToast(res.msg || "Failed to update profile.", "error");
  }

  return res;
}

/**
 * Sign out user and clear local cache
 */
function doLogout() {
  clearSession();
  showToast("Signed out successfully.");
  
  setTimeout(() => {
    // If in studio or user pages, route back to login
    if (window.location.pathname.includes("/user/") || window.location.pathname.includes("/studio")) {
      window.location.href = "../pages/login.html";
    } else {
      window.location.reload();
    }
  }, 800);
}
