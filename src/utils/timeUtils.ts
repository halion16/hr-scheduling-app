export const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

export const timeToDateObject = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const formatTime = (hours: number, minutes: number): string => {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const calculateWorkingHours = (startTime: string, endTime: string, breakMinutes: number): number => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  const totalMinutes = endMinutes - startMinutes;
  const workingMinutes = totalMinutes - breakMinutes;
  
  return workingMinutes / 60;
};

export const isTimeInRange = (time: string, startRange: string, endRange: string): boolean => {
  const timeMinutes = parseTime(time).hours * 60 + parseTime(time).minutes;
  const startMinutes = parseTime(startRange).hours * 60 + parseTime(startRange).minutes;
  const endMinutes = parseTime(endRange).hours * 60 + parseTime(endRange).minutes;
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
};

export const getDayOfWeek = (date: Date): string => {
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  return days[date.getDay()];
};

export const getDayOfWeekShort = (date: Date): string => {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  return days[date.getDay()];
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

export const formatDateLong = (date: Date): string => {
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Ottiene l'inizio della settimana (lunedì)
export const getStartOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Lunedì come primo giorno
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

// Ottiene la fine della settimana (domenica)
export const getEndOfWeek = (date: Date): Date => {
  const startOfWeek = getStartOfWeek(date);
  return addDays(startOfWeek, 6);
};

// Genera array di 7 giorni partendo dal lunedì
export const getWeekDays = (startOfWeek: Date): Date[] => {
  return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));
};

// Calcola il numero della settimana dell'anno (ISO 8601)
export const getWeekNumber = (date: Date): number => {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  // Giovedì della settimana corrente decide l'anno
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  // Gennaio 4 è sempre nella settimana 1
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  // Calcola il numero di settimane tra la data e la settimana 1
  return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000
                          - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Formatta il numero della settimana con l'anno se necessario
export const formatWeekNumber = (date: Date): string => {
  const weekNumber = getWeekNumber(date);
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();
  
  if (dateYear === currentYear) {
    return `Settimana ${weekNumber}`;
  } else {
    return `Settimana ${weekNumber}/${dateYear}`;
  }
};

// Converte una stringa di tempo (HH:MM) in minuti dal midnight
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};