// Local JSON user store for registration & login persistence
// Data is stored as a JSON array in localStorage

const STORAGE_KEY = "fir_users_json";

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users, null, 2));
}

export function registerUser(fullName, email, phone, password) {
  const users = getUsers();
  const exists = users.find(u => u.email === email);
  if (exists) return { ok: false, error: "Email already registered" };

  // Simple hash for local-only storage (not cryptographic — for demo purposes)
  const hashedPassword = btoa(password);

  const newUser = {
    id: users.length + 1,
    full_name: fullName,
    email,
    phone: phone || "",
    hashed_password: hashedPassword,
    created_at: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  return {
    ok: true,
    user: {
      id: newUser.id,
      full_name: newUser.full_name,
      email: newUser.email,
      phone: newUser.phone,
      created_at: newUser.created_at
    },
    access_token: "local_token_" + newUser.id + "_" + Date.now()
  };
}

export function loginUser(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) return { ok: false, error: "Invalid email or password" };

  const hashedPassword = btoa(password);
  if (user.hashed_password !== hashedPassword) {
    return { ok: false, error: "Invalid email or password" };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at
    },
    access_token: "local_token_" + user.id + "_" + Date.now()
  };
}

export function getAllUsers() {
  return getUsers().map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    created_at: u.created_at
  }));
}
