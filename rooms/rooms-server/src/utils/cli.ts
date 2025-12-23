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

function generateToken(type: string, role: AuthUserRoles, username: string): string {
  const payload: AuthUserTokenPayload = {
    username: username,
    type: type,
    role: role,
    claims: []
  };

  payload.claims = getClaimsByRole(role);

  return jwtSign(secretKey, payload);
}

function promptUser(): void {
  console.log('\nSelect an option:');
  console.log('1. Generate Admin Token');
  console.log('2. Generate User Token');
  console.log('4. Exit');

  rl.question('Enter your choice (1-4): ', (choice) => {
    switch (choice) {
      case '1':
        console.log('Admin Token:', generateToken("service", AuthUserRoles.admin, "admin"));
        promptUser();
        break;
      case '2':
        console.log('User Token:', generateToken("service", AuthUserRoles.user, "user"));
        promptUser();
        break;
      case '4':
        console.log('Exiting...');
        rl.close();
        break;
      default:
        console.log('Invalid choice. Please select 1, 2, 3, or 4.');
        promptUser();
    }
  });
}

console.log('Rooms Token Generator');
promptUser();

rl.on('close', () => {
  process.exit(0);
});