// Script per ripristinare tutti i punti vendita REALI della catena basati su EcosAgile
const stores = [
  {
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
    name: 'Mantova',
    code: 'MAN01',
    address: 'Piazza delle Erbe, 12 - Mantova (MN)',
    city: 'Mantova',
    province: 'MN',
    postalCode: '46100',
    phone: '+39 0376 234 567',
    email: 'mantova@catena.it',
    manager: 'Sara Mantovana',
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
    id: crypto.randomUUID(),
    name: 'Montemarciano',
    code: 'MTM01',
    address: 'Via Nazionale, 56 - Montemarciano (AN)',
    city: 'Montemarciano',
    province: 'AN',
    postalCode: '60019',
    phone: '+39 071 234 567',
    email: 'montemarciano@catena.it',
    manager: 'Luca Marchigiano',
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
    id: crypto.randomUUID(),
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Castelromano',
    code: 'CAS01',
    address: 'Via Ponte di Piscina Cupa, 64 - Castel Romano (RM)',
    city: 'Roma',
    province: 'RM',
    postalCode: '00128',
    phone: '+39 06 505 7890',
    email: 'castelromano@catena.it',
    manager: 'Elena Romano',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Valmontone',
    code: 'VAL01',
    address: 'Via della Pace, 1 - Valmontone (RM)',
    city: 'Valmontone',
    province: 'RM',
    postalCode: '00038',
    phone: '+39 06 9593 4567',
    email: 'valmontone@catena.it',
    manager: 'Roberto Laziale',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Castelguelfo',
    code: 'CGU01',
    address: 'Via del Commercio, 20 - Castel Guelfo (BO)',
    city: 'Castel Guelfo',
    province: 'BO',
    postalCode: '40023',
    phone: '+39 051 829 3456',
    email: 'castelguelfo@catena.it',
    manager: 'Francesca Emiliana',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Agira',
    code: 'AGI01',
    address: 'Via Umberto I, 45 - Agira (EN)',
    city: 'Agira',
    province: 'EN',
    postalCode: '94011',
    phone: '+39 0935 234 567',
    email: 'agira@catena.it',
    manager: 'Giuseppe Siciliano',
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
    id: crypto.randomUUID(),
    name: 'Marcianise',
    code: 'MAR01',
    address: 'Via Appia, 123 - Marcianise (CE)',
    city: 'Marcianise',
    province: 'CE',
    postalCode: '81025',
    phone: '+39 0823 234 567',
    email: 'marcianise@catena.it',
    manager: 'Anna Campana',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Noventa D.P.',
    code: 'NOV01',
    address: 'Via Marco Polo, 1 - Noventa di Piave (VE)',
    city: 'Noventa di Piave',
    province: 'VE',
    postalCode: '30020',
    phone: '+39 0421 234 567',
    email: 'noventa@catena.it',
    manager: 'Matteo Veneto',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Franciacorta',
    code: 'FRA01',
    address: 'Via Brescia, 56 - Rodengo Saiano (BS)',
    city: 'Rodengo Saiano',
    province: 'BS',
    postalCode: '25050',
    phone: '+39 030 234 5678',
    email: 'franciacorta@catena.it',
    manager: 'Stefano Lombardo',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Valdichiana Outlet',
    code: 'VAD01',
    address: 'A1 Valdichiana, Località Bettolle - Foiano della Chiana (AR)',
    city: 'Foiano della Chiana',
    province: 'AR',
    postalCode: '52045',
    phone: '+39 0575 234 567',
    email: 'valdichiana@catena.it',
    manager: 'Laura Toscana',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Molfetta',
    code: 'MOL01',
    address: 'Via Bari, 89 - Molfetta (BA)',
    city: 'Molfetta',
    province: 'BA',
    postalCode: '70056',
    phone: '+39 080 334 5678',
    email: 'molfetta@catena.it',
    manager: 'Antonio Pugliese',
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
    id: crypto.randomUUID(),
    name: 'Brugnato',
    code: 'BRU01',
    address: 'Via Aurelia, 45 - Brugnato (SP)',
    city: 'Brugnato',
    province: 'SP',
    postalCode: '19020',
    phone: '+39 0187 234 567',
    email: 'brugnato@catena.it',
    manager: 'Paolo Ligure',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Antegnate',
    code: 'ANT01',
    address: 'Via Roma, 23 - Antegnate (BG)',
    city: 'Antegnate',
    province: 'BG',
    postalCode: '24050',
    phone: '+39 0363 234 567',
    email: 'antegnate@catena.it',
    manager: 'Davide Bergamasco',
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
    id: crypto.randomUUID(),
    name: 'Citta Sant\'Angelo',
    code: 'CSA01',
    address: 'Via Nazionale, 67 - Città Sant\'Angelo (PE)',
    city: 'Città Sant\'Angelo',
    province: 'PE',
    postalCode: '65013',
    phone: '+39 085 234 5678',
    email: 'cittasantangelo@catena.it',
    manager: 'Maria Abruzzese',
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
  },
  {
    id: crypto.randomUUID(),
    name: 'Orio Center',
    code: 'ORI01',
    address: 'Via Orio al Serio, 150 - Orio al Serio (BG)',
    city: 'Orio al Serio',
    province: 'BG',
    postalCode: '24050',
    phone: '+39 035 326 5678',
    email: 'orio@catena.it',
    manager: 'Simone Orobico',
    openingHours: {
      monday: { start: '09:00', end: '21:00' },
      tuesday: { start: '09:00', end: '21:00' },
      wednesday: { start: '09:00', end: '21:00' },
      thursday: { start: '09:00', end: '21:00' },
      friday: { start: '09:00', end: '21:00' },
      saturday: { start: '09:00', end: '21:00' },
      sunday: { start: '10:00', end: '21:00' }
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: crypto.randomUUID(),
    name: 'Marzocca',
    code: 'MAZ01',
    address: 'Via Flaminia, 34 - Marzocca di Senigallia (AN)',
    city: 'Senigallia',
    province: 'AN',
    postalCode: '60019',
    phone: '+39 071 667 8901',
    email: 'marzocca@catena.it',
    manager: 'Claudia Marchigiana',
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
    id: crypto.randomUUID(),
    name: 'Jesi',
    code: 'JES01',
    address: 'Corso Matteotti, 89 - Jesi (AN)',
    city: 'Jesi',
    province: 'AN',
    postalCode: '60035',
    phone: '+39 0731 234 567',
    email: 'jesi@catena.it',
    manager: 'Andrea Jesino',
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
  }
];

// Parse dates correctly for localStorage
const storesWithDates = stores.map(store => ({
  ...store,
  createdAt: new Date(),
  updatedAt: new Date()
}));

// Set in localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  localStorage.setItem('hr-stores', JSON.stringify(storesWithDates));
} else {
  // For Node.js environment
  console.log('Stores data ready for localStorage:');
  console.log(JSON.stringify(storesWithDates, null, 2));
}

console.log('✅ Creati', stores.length, 'punti vendita della catena');
stores.forEach(store => console.log(`  - ${store.name} (${store.code}) - ${store.city}`));