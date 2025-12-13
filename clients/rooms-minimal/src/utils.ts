export function randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function generateRandomDisplayName() {
    const adjectives = [
        "Swift", "Silent", "Brave", "Golden", "Shadow", "Iron", "Wild",
        "Crimson", "Silver", "Lucky", "Fierce", "Rapid", "Mighty", "Bright",
        "Red", "Green"
    ];

    const nouns = [
        "Tiger", "Falcon", "Wolf", "Dragon", "Phoenix", "Lion",
        "Eagle", "Bear", "Shark", "Raven", "Panther", "Hawk",
        "Sun", "Star", "Moon", "Earth", "Mars", "Mecury", "Venus",
        "Pluto", "Neptune"
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 100); // 0–99

    return `${adjective}${noun}${number}`;
}

