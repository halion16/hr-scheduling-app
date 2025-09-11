// Test per simulare importazione dipendenti
console.log('🧪 TEST IMPORT SIMULATION');

// Simula 6 dipendenti con diversi store
const testEmployees = [
  {
    id: 'emp-001-test',
    firstName: 'Mario',
    lastName: 'Rossi', 
    email: 'mario.rossi@test.com',
    phone: '+39123456789',
    position: 'Commesso',
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-001',
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'emp-002-test',
    firstName: 'Luigi',
    lastName: 'Verdi',
    email: 'luigi.verdi@test.com', 
    phone: '+39123456790',
    position: 'Commesso',
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-001', // Stesso store del primo
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'emp-003-test',
    firstName: 'Anna',
    lastName: 'Bianchi',
    email: 'anna.bianchi@test.com',
    phone: '+39123456791', 
    position: 'Commesso',
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-002', // Negozio diverso
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'emp-004-test',
    firstName: 'Paolo',
    lastName: 'Gialli',
    email: 'paolo.gialli@test.com',
    phone: '+39123456792',
    position: 'Commesso', 
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-002', // Stesso del terzo
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'emp-005-test',
    firstName: 'Maria',
    lastName: 'Rosa',
    email: 'maria.rosa@test.com',
    phone: '+39123456793',
    position: 'Commesso',
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-003', // Terzo negozio
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time', 
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'emp-006-test',
    firstName: 'Giuseppe',
    lastName: 'Blu',
    email: 'giuseppe.blu@test.com',
    phone: '+39123456794',
    position: 'Commesso',
    department: 'Vendite',
    hireDate: new Date(),
    isActive: true,
    storeId: 'store-003', // Stesso del quinto
    skills: [],
    maxWeeklyHours: 40,
    minRestHours: 12,
    preferredShifts: [],
    contractType: 'full-time',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Store di test
const testStores = [
  {
    id: 'store-001',
    name: 'Negozio Milano Centro',
    address: 'Via Milano 1',
    phone: '+391111111',
    manager: 'Manager 1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'store-002', 
    name: 'Negozio Roma Termini',
    address: 'Via Roma 2',
    phone: '+392222222',
    manager: 'Manager 2',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'store-003',
    name: 'Negozio Napoli Centro',
    address: 'Via Napoli 3',
    phone: '+393333333',
    manager: 'Manager 3',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

console.log('📦 Salvando stores di test...');
localStorage.setItem('hr-stores', JSON.stringify(testStores));

console.log('👥 Salvando dipendenti di test...');
localStorage.setItem('hr-employees', JSON.stringify(testEmployees));

console.log('✅ Dati di test salvati!');
console.log(`📊 RIEPILOGO:`);
console.log(`- Store 001 (Milano Centro): 2 dipendenti`);
console.log(`- Store 002 (Roma Termini): 2 dipendenti`);
console.log(`- Store 003 (Napoli Centro): 2 dipendenti`);
console.log('🔄 Ricarica la pagina per vedere i dati!');