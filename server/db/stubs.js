
export const users = [];
export const sessions = [];

// Helper to find user
export const findUser = (email) => users.find(u => u.email === email);

// Helper to create user
export const createUser = (email, token) => {
    const user = { id: Date.now().toString(), email, jwt_token: token, session_expiry: Date.now() + 3600000 };
    users.push(user);
    return user;
};

// Helper to create session
export const createSession = (userId, token) => {
    const session = { user_id: userId, token, device: 'web' };
    sessions.push(session);
    return session;
}

export const getSession = (token) => sessions.find(s => s.token === token);
