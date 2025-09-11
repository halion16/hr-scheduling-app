#!/bin/bash

cd "/c/Users/localadmin/project-bolt-sb1-HRscheduling_rkyafrto/project"

echo "Fixing remaining unused variables and imports..."

# Fix HourBankDashboard.tsx - remove many unused imports
echo "Fixing HourBankDashboard.tsx..."
# Remove useMemo from React import if not used
sed -i 's/, useMemo//' "src/components/hourBank/HourBankDashboard.tsx"

# Remove unused time utility imports
sed -i 's/addDays, getStartOfWeek//' "src/components/hourBank/HourBankDashboard.tsx"
sed -i 's/, addDays, getStartOfWeek//' "src/components/hourBank/HourBankDashboard.tsx"

# Remove unused component imports
sed -i 's/Input, //' "src/components/hourBank/HourBankDashboard.tsx"
sed -i 's/, Input//' "src/components/hourBank/HourBankDashboard.tsx"
sed -i 's/ProtectedRoute, //' "src/components/hourBank/HourBankDashboard.tsx"
sed -i 's/, ProtectedRoute//' "src/components/hourBank/HourBankDashboard.tsx"

# Remove unused icon imports
sed -i 's/CheckCircle, //' "src/components/hourBank/HourBankDashboard.tsx"
sed -i 's/, CheckCircle//' "src/components/hourBank/HourBankDashboard.tsx"

# Fix HourBankSettings.tsx - remove unused imports
echo "Fixing HourBankSettings.tsx..."
sed -i 's/Eye, //' "src/components/hourBank/HourBankSettings.tsx"
sed -i 's/, Eye//' "src/components/hourBank/HourBankSettings.tsx"
sed -i 's/AlertTriangle, //' "src/components/hourBank/HourBankSettings.tsx"
sed -i 's/, AlertTriangle//' "src/components/hourBank/HourBankSettings.tsx"

# Fix HourBankStoreView.tsx - remove unused imports
echo "Fixing HourBankStoreView.tsx..."
sed -i 's/AlertTriangle, //' "src/components/hourBank/HourBankStoreView.tsx"
sed -i 's/, AlertTriangle//' "src/components/hourBank/HourBankStoreView.tsx"
sed -i 's/FileDown, //' "src/components/hourBank/HourBankStoreView.tsx"
sed -i 's/, FileDown//' "src/components/hourBank/HourBankStoreView.tsx"

# Fix ManualScheduleEntry.tsx - remove unused imports
echo "Fixing ManualScheduleEntry.tsx..."
sed -i 's/AlertTriangle, //' "src/components/schedule/ManualScheduleEntry.tsx"
sed -i 's/, AlertTriangle//' "src/components/schedule/ManualScheduleEntry.tsx"

# Fix ScheduleDisplay.tsx - remove unused imports
echo "Fixing ScheduleDisplay.tsx..."
sed -i 's/AlertTriangle, //' "src/components/schedule/ScheduleDisplay.tsx"
sed -i 's/, AlertTriangle//' "src/components/schedule/ScheduleDisplay.tsx"

# Fix utils files - remove unused imports
echo "Fixing utils files..."

# Fix exportUtils.ts
sed -i 's/formatDate, calculateWorkingHours//' "src/utils/exportUtils.ts"
sed -i 's/, formatDate, calculateWorkingHours//' "src/utils/exportUtils.ts"

# Fix shiftGridValidation.ts  
sed -i 's/formatDate, addDays, getStartOfWeek, formatWeekNumber//' "src/utils/shiftGridValidation.ts"
sed -i 's/, formatDate, addDays, getStartOfWeek, formatWeekNumber//' "src/utils/shiftGridValidation.ts"

echo "Completed fixing unused variables and imports."
echo "Running ESLint to check progress..."
npx eslint src/ | grep -E "warning|error" | wc -l