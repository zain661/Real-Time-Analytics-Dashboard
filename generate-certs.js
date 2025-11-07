// Generate SSL Certificates using mkcert
// Run: node generate-certs.js

import mkcert from 'mkcert';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateCertificates() {
  console.log('🔐 Generating SSL certificates using mkcert...\n');

  try {
    // Create certs directory
    const certsDir = join(__dirname, 'approach4', 'certs');
    mkdirSync(certsDir, { recursive: true });
    console.log('✅ Created directory:', certsDir);

    // Create a certificate authority (CA)
    console.log('🔑 Creating Certificate Authority...');
    const ca = await mkcert.createCA({
      organization: 'Real-Time Analytics Dashboard',
      countryCode: 'PS',
      state: 'West Bank',
      locality: 'Nablus',
      validity: 365 // Valid for 1 year
    });

    // Create certificate for localhost
    console.log('📜 Generating certificate for localhost...');
    const cert = await mkcert.createCert({
      domains: ['localhost', '127.0.0.1', '::1'],
      validity: 365,
      ca: {
        key: ca.key,
        cert: ca.cert
      }
    });

    // Save private key
    const keyPath = join(certsDir, 'server-key.pem');
    writeFileSync(keyPath, cert.key);
    console.log('✅ Private key saved:', keyPath);

    // Save certificate
    const certPath = join(certsDir, 'server-cert.pem');
    writeFileSync(certPath, cert.cert);
    console.log('✅ Certificate saved:', certPath);

    // Save CA certificate (optional, for trusting in browser)
    const caPath = join(certsDir, 'ca-cert.pem');
    writeFileSync(caPath, ca.cert);
    console.log('✅ CA certificate saved:', caPath);

    console.log('\n✨ Certificate generation complete!\n');
    console.log('📁 Files created in approach4/certs/:');
    console.log('   • server-key.pem  (private key)');
    console.log('   • server-cert.pem (server certificate)');
    console.log('   • ca-cert.pem     (CA certificate)\n');
    
    console.log('🎯 Next steps:');
    console.log('   1. Run: npm run start4');
    console.log('   2. Open: https://localhost:4002/dashboard.html');
    console.log('   3. Accept certificate warning in browser\n');
    
    console.log('💡 Tip: To avoid browser warnings, import ca-cert.pem');
    console.log('   into your browser\'s trusted certificates.\n');

  } catch (error) {
    console.error('❌ Error generating certificates:', error.message);
    process.exit(1);
  }
}

generateCertificates();