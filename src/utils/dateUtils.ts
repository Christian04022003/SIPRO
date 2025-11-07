// src/utils/dateUtils.ts

// Calcula la duración en días calendario (incluye ambos días)
export const getDurationInDays = (startStr: string, endStr: string): number => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
};

// Suma días a una fecha (devuelve string YYYY-MM-DD)
export const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

// Compara dos fechas y devuelve la más temprana
export const minDate = (dateStrA: string | null, dateStrB: string | null): string | null => {
    if (!dateStrA) return dateStrB;
    if (!dateStrB) return dateStrA;
    return (new Date(dateStrA) < new Date(dateStrB)) ? dateStrA : dateStrB;
};

// Compara dos fechas y devuelve la más tardía
export const maxDate = (dateStrA: string | null, dateStrB: string | null): string | null => {
    if (!dateStrA) return dateStrB;
    if (!dateStrB) return dateStrA;
    return (new Date(dateStrA) > new Date(dateStrB)) ? dateStrA : dateStrB;
};