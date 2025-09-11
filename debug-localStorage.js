// Script per debuggare localStorage
console.log('=== DEBUG LOCALSTORAGE ===');

const employees = localStorage.getItem('hr-employees');
const stores = localStorage.getItem('hr-stores');

console.log('📋 EMPLOYEES:', employees ? JSON.parse(employees) : 'NESSUNO');
console.log('🏪 STORES:', stores ? JSON.parse(stores) : 'NESSUNO');

if (employees) {
  const parsedEmployees = JSON.parse(employees);
  console.log('👥 Totale dipendenti:', parsedEmployees.length);
  
  // Raggruppa per storeId
  const byStore = parsedEmployees.reduce((acc, emp) => {
    const storeId = emp.storeId || 'NO_STORE';
    acc[storeId] = (acc[storeId] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 Dipendenti per negozio:', byStore);
  
  // Lista dettagliata
  parsedEmployees.forEach((emp, i) => {
    console.log(`${i+1}. ${emp.firstName} ${emp.lastName} (${emp.id}) - Store: ${emp.storeId}`);
  });
}

if (stores) {
  const parsedStores = JSON.parse(stores);
  console.log('🏪 Totale negozi:', parsedStores.length);
  
  parsedStores.forEach((store, i) => {
    console.log(`${i+1}. ${store.name} (${store.id})`);
  });
}