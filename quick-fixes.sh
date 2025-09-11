#!/bin/bash

# Remove unused imports systematically
cd "/c/Users/localadmin/project-bolt-sb1-HRscheduling_rkyafrto/project"

echo "Starting systematic ESLint fixes..."

# Fix LoginPage.tsx - remove unused isLoginMode variable
echo "Fixing LoginPage.tsx..."
sed -i '/const \[isLoginMode, setIsLoginMode\] = useState(true);/d' "src/components/auth/LoginPage.tsx"

# Fix UserManagement.tsx - remove unused imports
echo "Fixing UserManagement.tsx..."
sed -i 's/Settings, CheckCircle, //' "src/components/auth/UserManagement.tsx"
sed -i 's/, Settings, CheckCircle//' "src/components/auth/UserManagement.tsx"
sed -i 's/Settings, CheckCircle//' "src/components/auth/UserManagement.tsx"

# Fix RefreshDataButton.tsx - remove AlertTriangle
echo "Fixing RefreshDataButton.tsx..."
sed -i 's/AlertTriangle, //' "src/components/common/RefreshDataButton.tsx"
sed -i 's/, AlertTriangle//' "src/components/common/RefreshDataButton.tsx"
sed -i 's/AlertTriangle//' "src/components/common/RefreshDataButton.tsx"

# Fix Tabs.tsx - remove useState
echo "Fixing Tabs.tsx..."
sed -i 's/, useState//' "src/components/common/Tabs.tsx"

# Fix EmployeeDebugModal.tsx - remove Download and unused variables
echo "Fixing EmployeeDebugModal.tsx..."
sed -i 's/Download, //' "src/components/debug/EmployeeDebugModal.tsx"
sed -i 's/, Download//' "src/components/debug/EmployeeDebugModal.tsx"
sed -i '/const \[rawApiData, setRawApiData\] = useState<any>(null);/d' "src/components/debug/EmployeeDebugModal.tsx"

# Fix EmployeeList.tsx - remove Search
echo "Fixing EmployeeList.tsx..."
sed -i 's/Search, //' "src/components/employees/EmployeeList.tsx"
sed -i 's/, Search//' "src/components/employees/EmployeeList.tsx"
sed -i 's/Search//' "src/components/employees/EmployeeList.tsx"

# Fix EmployeeSyncModal.tsx - remove unused imports
echo "Fixing EmployeeSyncModal.tsx..."
sed -i 's/Eye, //' "src/components/employees/EmployeeSyncModal.tsx"
sed -i 's/Filter, //' "src/components/employees/EmployeeSyncModal.tsx" 
sed -i 's/Building, //' "src/components/employees/EmployeeSyncModal.tsx"
sed -i 's/, Eye, Filter, Building//' "src/components/employees/EmployeeSyncModal.tsx"

echo "Phase 1 fixes completed. Running ESLint to check progress..."
npx eslint src/ --max-warnings 50 | head -20