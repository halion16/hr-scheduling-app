// Script per ripristinare negozi - Apri console browser e digita: 
// location.reload() dopo aver eseguito questo file

const negozi = [
  {
    id: 'mon01-' + Date.now(),
    name: 'Mondovì',
    code: 'MON01',
    address: 'Via Roma, 45 - Mondovì (CN)',
    city: 'Mondovì',
    province: 'CN',
    postalCode: '12084',
    phone: '+39 0174 234 567',
    email: 'mondovi@catena.it',
    manager: 'Giulia Piemonte',
    openingHours: {
      monday: { start: '09:00', end: '19:30' },
      tuesday: { start: '09:00', end: '19:30' },
      wednesday: { start: '09:00', end: '19:30' },
      thursday: { start: '09:00', end: '19:30' },
      friday: { start: '09:00', end: '19:30' },
      saturday: { start: '09:00', end: '19:30' },
      sunday: { start: '10:00', end: '19:00' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'set01-' + Date.now(),
    name: 'Settimo Torinese',
    code: 'SET01',
    address: 'Via Italia, 78 - Settimo Torinese (TO)',
    city: 'Settimo Torinese',
    province: 'TO',
    postalCode: '10036',
    phone: '+39 011 801 2345',
    email: 'settimo@catena.it',
    manager: 'Marco Torinese',
    openingHours: {
      monday: { start: '09:00', end: '19:30' },
      tuesday: { start: '09:00', end: '19:30' },
      wednesday: { start: '09:00', end: '19:30' },
      thursday: { start: '09:00', end: '19:30' },
      friday: { start: '09:00', end: '19:30' },
      saturday: { start: '09:00', end: '19:30' },
      sunday: { start: '10:00', end: '19:00' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'bar01-' + Date.now(),
    name: 'Barberino',
    code: 'BAR01',
    address: 'Via Meucci, 1 - Barberino di Mugello (FI)',
    city: 'Barberino di Mugello',
    province: 'FI',
    postalCode: '50031',
    phone: '+39 055 842 161',
    email: 'barberino@catena.it',
    manager: 'Mario Rossi',
    openingHours: {
      monday: { start: '10:00', end: '20:00' },
      tuesday: { start: '10:00', end: '20:00' },
      wednesday: { start: '10:00', end: '20:00' },
      thursday: { start: '10:00', end: '20:00' },
      friday: { start: '10:00', end: '20:00' },
      saturday: { start: '10:00', end: '20:00' },
      sunday: { start: '10:00', end: '20:00' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Salva nel localStorage
localStorage.setItem('hr-stores', JSON.stringify(negozi));
console.log('✅ Negozi salvati!');
console.log('🔄 Ricarica la pagina per vederli');

// Ricarica automaticamente
setTimeout(() => location.reload(), 1000);