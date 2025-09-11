const fs = require('fs');
const path = require('path');

// Define the fixes for unused imports
const fixes = [
  // ProtectedRoute.tsx
  {
    file: 'src/components/auth/ProtectedRoute.tsx',
    from: "import { ShieldX, Lock, AlertTriangle } from 'lucide-react';",
    to: "import { ShieldX, Lock } from 'lucide-react';"
  },
  // UserManagement.tsx
  {
    file: 'src/components/auth/UserManagement.tsx',
    from: /import\s*{\s*[^}]*Settings[^}]*,\s*CheckCircle[^}]*}\s*from\s*'lucide-react';/,
    to: function(content) {
      // Remove Settings and CheckCircle while keeping other imports
      return content.replace(
        /import\s*{\s*([^}]*),?\s*Settings[^}]*,?\s*([^}]*),?\s*CheckCircle[^}]*,?\s*([^}]*)\s*}\s*from\s*'lucide-react';/,
        "import { $1 $2 $3 } from 'lucide-react';"
      ).replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
    }
  },
  // RefreshDataButton.tsx
  {
    file: 'src/components/common/RefreshDataButton.tsx',
    from: /import\s*{\s*[^}]*AlertTriangle[^}]*}\s*from\s*'lucide-react';/,
    to: function(content) {
      return content.replace(
        /import\s*{\s*([^}]*),?\s*AlertTriangle[^}]*,?\s*([^}]*)\s*}\s*from\s*'lucide-react';/,
        "import { $1 $2 } from 'lucide-react';"
      ).replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
    }
  },
  // Tabs.tsx
  {
    file: 'src/components/common/Tabs.tsx',
    from: "import React, { ReactNode, useState } from 'react';",
    to: "import React, { ReactNode } from 'react';"
  },
  // EmployeeDebugModal.tsx
  {
    file: 'src/components/debug/EmployeeDebugModal.tsx',
    from: /import\s*{\s*[^}]*Download[^}]*}\s*from\s*'lucide-react';/,
    to: function(content) {
      return content.replace(
        /import\s*{\s*([^}]*),?\s*Download[^}]*,?\s*([^}]*)\s*}\s*from\s*'lucide-react';/,
        "import { $1 $2 } from 'lucide-react';"
      ).replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
    }
  }
];

// Apply fixes
fixes.forEach(fix => {
  const filePath = path.join(__dirname, fix.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (typeof fix.to === 'function') {
      content = fix.to(content);
    } else {
      content = content.replace(fix.from, fix.to);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${fix.file}`);
  } else {
    console.log(`File not found: ${fix.file}`);
  }
});

console.log('Unused imports cleanup completed!');