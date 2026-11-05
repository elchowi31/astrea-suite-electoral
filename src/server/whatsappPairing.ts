import type {AuthenticationCreds} from '@whiskeysockets/baileys';

/** Baileys web pairing emits a signed account in pair-success, but does not set
 * creds.registered. requestPairingCode already sets creds.me before approval.
 * A phone identity alone is therefore not sufficient to resume a login.
 * See Baileys v7.0.0-rc14 socket.ts / configureSuccessfulPairing. */
export function hasPairedWhatsappIdentity(creds:Pick<AuthenticationCreds,'me'|'account'>):boolean{
 return !!(creds.me?.id&&creds.account?.accountSignature?.length&&creds.account?.deviceSignature?.length);
}
