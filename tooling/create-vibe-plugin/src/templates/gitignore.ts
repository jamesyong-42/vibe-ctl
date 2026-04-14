export function gitignoreTemplate(): string {
  return `node_modules
dist
.turbo
*.log
.DS_Store
`;
}
