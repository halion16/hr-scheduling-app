// MAPPING SEMPLICE: organizationalUnit -> negozio
const simpleMapping = (employee, stores) => {
  const orgUnit = employee.organizationalUnit || '';
  
  // Cerca negozio con nome uguale/simile all'unità organizzativa
  for (const store of stores) {
    if (store.name.toLowerCase() === orgUnit.toLowerCase()) {
      console.log(`✅ MATCH ESATTO: ${orgUnit} → ${store.name}`);
      return { storeId: store.id, storeName: store.name, confidence: 'high' };
    }
  }
  
  // Nessun match - primo negozio
  const firstStore = stores[0];
  console.log(`❌ NO MATCH: ${orgUnit} → Default: ${firstStore?.name}`);
  return { 
    storeId: firstStore?.id || '', 
    storeName: firstStore?.name || 'Default', 
    confidence: 'low' 
  };
};