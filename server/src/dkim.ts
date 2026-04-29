// Per-domain DKIM keypair lifecycle.
// Keys are stored in the domains table. The private key signs outbound mail (via nodemailer).
// The public key is published as a TXT record at <selector>._domainkey.<domain>.
//
// We generate RSA-2048 (broadly supported; ed25519 is also possible but less universal).

import { generateKeyPairSync } from 'node:crypto';
import { db } from './db.js';
import type { Domain } from './db.js';
import { config } from './config.js';

export type DkimKeypair = {
  selector: string;
  privateKeyPem: string;
  publicKeyPem: string;
};

export function generateKeypair(): DkimKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    selector: config.dkim.selector,
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
  };
}

const findDomain = db.prepare('SELECT * FROM domains WHERE id = ?');
const findDomainByName = db.prepare('SELECT * FROM domains WHERE name = ?');
const updateDkim = db.prepare(`
  UPDATE domains SET dkim_selector = ?, dkim_private_pem = ?, dkim_public_pem = ? WHERE id = ?
`);

// Ensures the domain has a keypair; generates one if missing. Returns the domain.
export function ensureDkim(domainId: number): Domain {
  const dom = findDomain.get(domainId) as Domain | undefined;
  if (!dom) throw new Error(`no such domain id=${domainId}`);
  if (!dom.dkim_private_pem || !dom.dkim_public_pem) {
    const kp = generateKeypair();
    updateDkim.run(kp.selector, kp.privateKeyPem, kp.publicKeyPem, dom.id);
    return { ...dom, dkim_selector: kp.selector, dkim_private_pem: kp.privateKeyPem, dkim_public_pem: kp.publicKeyPem };
  }
  return dom;
}

export function ensureDkimByName(name: string): Domain | null {
  const dom = findDomainByName.get(name.toLowerCase()) as Domain | undefined;
  if (!dom) return null;
  return ensureDkim(dom.id);
}

// Convert a SPKI PEM to the bare base64 needed in a DNS TXT record.
export function pemToDnsKey(pubPem: string): string {
  return pubPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
}

export function dnsRecord(dom: Domain): {
  host: string;
  type: 'TXT';
  value: string;
  copyPaste: string;
} {
  if (!dom.dkim_selector || !dom.dkim_public_pem) {
    throw new Error(`domain ${dom.name} has no DKIM key`);
  }
  const k = pemToDnsKey(dom.dkim_public_pem);
  const value = `v=DKIM1; k=rsa; p=${k}`;
  const host = `${dom.dkim_selector}._domainkey.${dom.name}.`;
  return {
    host,
    type: 'TXT',
    value,
    // Many DNS providers want quoted strings split at 255 chars; provide a copy-paste-safe form.
    copyPaste: `${host}\tIN\tTXT\t"${value}"`,
  };
}
