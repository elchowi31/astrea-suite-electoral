export function workspaceTokenCache(now: () => number = Date.now) {
  let token: string | null = null,
    owner = '',
    scope = '',
    expiresAt = 0,
    account: { email: string; googleUid: string } | null = null;
  const clear = () => {
    token = null;
    owner = '';
    expiresAt = 0;
    account = null;
  };
  return {
    clear,
    setScope(next: string) {
      if (scope !== next) {
        clear();
        scope = next;
      }
    },
    save(
      value: string,
      uid: string,
      expectedScope: string,
      googleAccount?: { email: string; googleUid: string },
    ) {
      if (!uid || scope !== expectedScope)
        throw new Error(
          'La cuenta u organización cambió durante la conexión de Google.',
        );
      token = value;
      owner = uid;
      expiresAt = now() + 45 * 60_000;
      account = googleAccount || null;
    },
    get(uid: string | null) {
      if (!uid || uid !== owner || now() >= expiresAt) {
        clear();
        return null;
      }
      return token;
    },
    scope: () => scope,
    account(uid: string | null) {
      if (!uid || uid !== owner || now() >= expiresAt) {
        clear();
        return null;
      }
      return account;
    },
  };
}
