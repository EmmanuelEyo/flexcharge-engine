import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Here you would proxy the login request to Peter's Backend
        // For example:
        // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        //   method: 'POST',
        //   body: JSON.stringify(credentials),
        //   headers: { "Content-Type": "application/json" }
        // })
        // const user = await res.json()
        
        // Mocking a successful login for now
        if (credentials?.email && credentials?.password) {
          return {
            id: "1",
            name: "John Doe",
            email: credentials.email,
            // Assuming your backend returns a JWT token
            token: "mock_jwt_token_from_backend",
          };
        }
        
        // Return null if user data could not be retrieved
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // If user object is available (during initial login), add the backend token to the JWT
      if (user) {
        token.accessToken = (user as any).token;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose the backend token and user ID to the client session
      (session as any).accessToken = token.accessToken;
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Redirects to our custom login page
  },
};
