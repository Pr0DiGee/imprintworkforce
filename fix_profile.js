const fs = require('fs');
let file = fs.readFileSync('app/dashboard/profile/ProfileForm.tsx', 'utf8');
let splitIdx = file.indexOf('import { useState, useRef } from "react";', 500);
if (splitIdx !== -1) {
  fs.writeFileSync('app/dashboard/profile/ProfileForm.tsx', file.substring(0, splitIdx));
  console.log('Fixed duplication');
}
