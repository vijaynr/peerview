import {
  branchExists,
  compareBranches,
  createMergeRequest,
  findExistingMergeRequest,
  findOpenMergeRequestBySourceBranch,
  getMergeRequest,
  getMergeRequestChanges,
  getMergeRequestCommits,
  getProjectDefaultBranch,
  listBranches,
  listMergeRequests,
  remoteToProjectPath,
  updateMergeRequest,
  getFileRaw,
} from "../utils/gitlab.js";
import {
  addInlineMergeRequestComment,
  addMergeRequestComment,
  getMergeRequestInlineComments,
} from "../utils/gitlabComments.js";
import type { GitLabInlineComment } from "../types/gitlab.js";
import type { MergeRequestState } from "../types/workflows.js";

export type { GitLabInlineComment };

export interface GitLabClient {
  listBranches(projectPath: string): Promise<string[]>;
  getDefaultBranch(projectPath: string): Promise<string>;
  branchExists(projectPath: string, branchName: string): Promise<boolean>;
  listMergeRequests(
    projectPath: string,
    state: MergeRequestState
  ): Promise<
    Array<{ iid: number; title: string; state: string; web_url: string; description?: string }>
  >;
  findOpenMergeRequestBySourceBranch(
    projectPath: string,
    sourceBranch: string
  ): Promise<{ iid: number; title: string; state: string; web_url: string } | null>;
  getMergeRequest(
    projectPath: string,
    mrIid: number
  ): Promise<{
    iid: number;
    title: string;
    state: string;
    web_url: string;
    description?: string;
    diff_refs?: { base_sha?: string; start_sha?: string; head_sha?: string };
  }>;
  getMergeRequestChanges(
    projectPath: string,
    mrIid: number
  ): Promise<Array<{ old_path?: string; new_path?: string; diff?: string }>>;
  getMergeRequestCommits(
    projectPath: string,
    mrIid: number
  ): Promise<Array<{ id: string; title: string; message: string }>>;
  getFileRaw(projectPath: string, filePath: string, ref: string): Promise<string | null>;
  getMergeRequestInlineComments(projectPath: string, mrIid: number): Promise<GitLabInlineComment[]>;
  addInlineMergeRequestComment(
    projectPath: string,
    mrIid: number,
    body: string,
    filePath: string,
    line: number,
    positionType: "new" | "old"
  ): Promise<string>;
  addMergeRequestComment(projectPath: string, mrIid: number, body: string): Promise<string>;
  compareBranches(projectPath: string, sourceBranch: string, targetBranch: string): Promise<string>;
  findExistingMergeRequest(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<{ iid: number; web_url: string } | null>;
  createMergeRequest(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string
  ): Promise<string>;
  updateMergeRequest(
    projectPath: string,
    mrIid: number,
    title: string,
    description: string
  ): Promise<string>;
}

export function createGitLabClient(baseUrl: string, token: string): GitLabClient {
  return {
    listBranches: (projectPath) => listBranches(baseUrl, token, projectPath),
    getDefaultBranch: (projectPath) => getProjectDefaultBranch(baseUrl, token, projectPath),
    branchExists: (projectPath, branchName) => branchExists(baseUrl, token, projectPath, branchName),
    listMergeRequests: (projectPath, state) =>
      listMergeRequests(baseUrl, token, projectPath, state),
    findOpenMergeRequestBySourceBranch: (projectPath, sourceBranch) =>
      findOpenMergeRequestBySourceBranch(baseUrl, token, projectPath, sourceBranch),
    getMergeRequest: (projectPath, mrIid) => getMergeRequest(baseUrl, token, projectPath, mrIid),
    getMergeRequestChanges: (projectPath, mrIid) =>
      getMergeRequestChanges(baseUrl, token, projectPath, mrIid),
    getMergeRequestCommits: (projectPath, mrIid) =>
      getMergeRequestCommits(baseUrl, token, projectPath, mrIid),
    getFileRaw: (projectPath, filePath, ref) => getFileRaw(baseUrl, token, projectPath, filePath, ref),
    getMergeRequestInlineComments: (projectPath, mrIid) =>
      getMergeRequestInlineComments(baseUrl, token, projectPath, mrIid),
    addInlineMergeRequestComment: (projectPath, mrIid, body, filePath, line, positionType) =>
      addInlineMergeRequestComment(
        baseUrl,
        token,
        projectPath,
        mrIid,
        body,
        filePath,
        line,
        positionType
      ),
    addMergeRequestComment: (projectPath, mrIid, body) =>
      addMergeRequestComment(baseUrl, token, projectPath, mrIid, body),
    compareBranches: (projectPath, sourceBranch, targetBranch) =>
      compareBranches(baseUrl, token, projectPath, sourceBranch, targetBranch),
    findExistingMergeRequest: (projectPath, sourceBranch, targetBranch) =>
      findExistingMergeRequest(baseUrl, token, projectPath, sourceBranch, targetBranch),
    createMergeRequest: (projectPath, sourceBranch, targetBranch, title, description) =>
      createMergeRequest(
        baseUrl,
        token,
        projectPath,
        sourceBranch,
        targetBranch,
        title,
        description
      ),
    updateMergeRequest: (projectPath, mrIid, title, description) =>
      updateMergeRequest(baseUrl, token, projectPath, mrIid, title, description),
  };
}

export { remoteToProjectPath };
