// Script di pulizia localStorage
console.log('🧹 PULIZIA INIZIATA');

// Mostra stato prima
console.log('Prima:', localStorage.getItem('hr-employees') ? JSON.parse(localStorage.getItem('hr-employees')).length : 0, 'dipendenti');

// Pulizia totale
localStorage.removeItem('hr-employees');
localStorage.removeItem('hr-stores');
localStorage.removeItem('hr-shifts');
localStorage.removeItem('hr-unavailabilities');

console.log('✅ TUTTO PULITO!');

// Ricrea negozi
const stores = [
  'Antegnate','Mantova','Barberino','Castelromano','Valmontone',
  'Castelguelfo','Agira','Marcianise','Noventa D.P.','Valdichiana',
  'Molfetta','Brugnato','Franciacorta','Orio Center','Citta Sant\'Angelo',
  'Marzocca','Jesi'
];

const storeObjects = stores.map(name => ({
    id: crypto.randomUUID(),
    name: name,
    address: '',
    phone: '',
    email: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
}));

localStorage.setItem('hr-stores', JSON.stringify(storeObjects));

console.log('🏪 CREATI', storeObjects.length, 'NEGOZI');
console.log('✅ RICARICA LA PAGINA HR (F5)');