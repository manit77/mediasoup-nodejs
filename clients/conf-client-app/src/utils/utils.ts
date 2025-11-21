export function getQueryParams(): Record<string, string> {
    const params = new URLSearchParams(window.location.search);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

export function objectToQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value);
    }
  });
  return searchParams.toString();
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
