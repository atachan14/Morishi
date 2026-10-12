import {defineConfig} from 'vite';
export default defineConfig({server:{watch:{ignored:['**/scripts/**','**/evidence/**','**/docs/**','**/.test-dist/**','**/tests/**']}},build:{rollupOptions:{input:{main:'index.html',ecosystem:'ecosystem.html',elementSkills:'ecosystem-v2.html'}}}});
