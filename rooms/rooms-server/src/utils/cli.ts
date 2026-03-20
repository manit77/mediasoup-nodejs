import { AuthUserRoles } from "@rooms/rooms-models";
import { AuthClaims, AuthUserTokenPayload } from "../models/tokenPayloads.js";
import { jwtSign } from "./jwtUtil.js";
import * as readline from 'readline';
import { RoomServerConfig } from "../roomServer/models.js";
import { getENV } from "./env.js";
import { getClaimsByRole } from "../roomServer/utils.js";

let config: RoomServerConfig = await getENV() as any;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const secretKey = config.room_secret_key;

if (!secretKey) {
  console.error("no env variable set for room_secret_key: export room_secret_key=your-secure-secret-key");
}

function generateToken(
  type: string,
  role: AuthUserRoles,
  username: string,
  expiresInMin: number = 60 * 24,
  issuer: string = "",
  audience: string = ""
): string {

  console.log(`generateToken ${type} ${role} ${username} ${expiresInMin} ${issuer} ${audience}`);
  
  const payload: AuthUserTokenPayload = {
    username: username,
    type: type,
    role: role,
    claims: getClaimsByRole(role),
    iss: issuer,
    aud: audience
  };

  return jwtSign(secretKey, payload, expiresInMin);
}

function promptTokenDetails(type: string, role: AuthUserRoles, defaultName: string) {
  rl.question(`Enter username (default ${defaultName}): `, (username) => {
    const name = username.trim() || defaultName;
    rl.question('Enter expiration in days (default 1): ', (expiresInput) => {
      const days = Number.parseFloat(expiresInput);
      const mins = Number.isFinite(days) && days > 0 ? days * 1440 : 1440;

      rl.question('Enter issuer (default empty): ', (issuerInput) => {
        const issuer = issuerInput.trim();
        rl.question('Enter audience (default empty): ', (audienceInput) => {
          const audience = audienceInput.trim();
          console.log(`${role} Token:`, generateToken(type, role, name, mins, issuer, audience));
          promptUser();
        });
      });
    });
  });
}

function promptUser(): void {
  console.log('\nSelect an option:');
  console.log('1. Generate Service Token');
  console.log('2. Generate Admin Token');
  console.log('3. Generate User Token');
  console.log('4. Generate Guest Token');
  console.log('0. Exit');

  rl.question('Enter your choice (1-4): ', (choice) => {
    switch (choice) {
      case '1':
        promptTokenDetails("service", AuthUserRoles.service, "service");
        break;
      case '2':
        promptTokenDetails("admin_session", AuthUserRoles.admin, "admin");
        break;
      case '3':
        promptTokenDetails("user_session", AuthUserRoles.user, "user");
        break;
      case '4':
        promptTokenDetails("guest_session", AuthUserRoles.guest, "guest");
        break;
      case '0':
        console.log('Exiting...');
        rl.close();
        break;
      default:
        console.log('Invalid choice.');
        promptUser();
    }
  });
}

console.log('Rooms Token Generator');
promptUser();

rl.on('close', () => {
  process.exit(0);
});