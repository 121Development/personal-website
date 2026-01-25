export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  content: string;
  excerpt?: string;
  image?: string;
}

export interface Project {
  name: string;
  description: string;
  url?: string;
  github?: string;
}

export interface ContentSection {
  title: string;
  content: string;
}
