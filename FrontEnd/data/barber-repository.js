const BARBERS_STORAGE_KEY = "norte-barber-barbers";

export function getBarbers() {
	try {
		return JSON.parse(localStorage.getItem(BARBERS_STORAGE_KEY)) || [];
	} catch {
		return [];
	}
}

export function saveBarbers(barbers) {
	localStorage.setItem(BARBERS_STORAGE_KEY, JSON.stringify(barbers));
}

export function createBarber(data) {
	return {
		id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
		name: data.name.trim(),
		location: data.location,
		days: data.days,
		start: data.start,
		end: data.end
	};
}

export function addBarber(data) {
	const barber = createBarber(data);
	saveBarbers([...getBarbers(), barber]);
	return barber;
}

export function removeBarber(id) {
	const remainingBarbers = getBarbers().filter((barber) => barber.id !== id);
	saveBarbers(remainingBarbers);
}
