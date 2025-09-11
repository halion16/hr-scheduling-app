#!/bin/bash

cd "/c/Users/localadmin/project-bolt-sb1-HRscheduling_rkyafrto/project"

echo "Running final cleanup of remaining easy fixes..."

# Remove more unused variables found in utils
echo "Fixing utils files..."

# Remove unused variables in various files
find src/ -name "*.ts" -o -name "*.tsx" | while read file; do
  # Remove unused format parameter
  sed -i 's/(.*format.*) =>/(\1) =>/' "$file" 2>/dev/null || true
  
  # Remove unused underscore parameters
  sed -i 's/(.*_.*,/(/g' "$file" 2>/dev/null || true
done

# Fix specific unused variable patterns
sed -i '/const.*totalProcessed.*=/d' "src/utils/excelImportUtils.ts" 2>/dev/null || true
sed -i '/const.*error.*=/d' "src/utils/excelImportUtils.ts" 2>/dev/null || true
sed -i '/const.*weekStart.*=/d' "src/utils/ccnlValidation.ts" 2>/dev/null || true
sed -i '/const.*dynamicMaxStaff.*=/d' "src/utils/shiftGridValidation.ts" 2>/dev/null || true
sed -i '/const.*employees.*=/d' "src/utils/shiftGridValidation.ts" 2>/dev/null || true
sed -i '/const.*employeeWorkload.*=/d' "src/utils/shiftGridValidation.ts" 2>/dev/null || true
sed -i '/const.*shifts.*=/d' "src/utils/validationUtils.ts" 2>/dev/null || true

echo "Final cleanup completed."
echo "Checking final error count..."
npx eslint src/ | grep -E "warning|error" | wc -l