import { graphql } from '@octokit/graphql';
import * as dotenv from 'dotenv';


dotenv.config({ path: __dirname + "/.env.local" });

const GITHUB_API_KEY = process.env.GITHUB_API_KEY;

const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `Authorization: token ${GITHUB_API_KEY}`,
    },
  });
  const { repository } = await graphqlWithAuth(`
    {
      repository(owner: "octokit", name: "graphql.js") {
        issues(last: 3) {
          edges {
            node {
              title
            }
          }
        }
      }
    }
  `);

console.log(repository)