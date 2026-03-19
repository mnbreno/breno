#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class TwentyCRMServer {
  constructor() {
    this.server = new Server(
      {
        name: "twenty-crm",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiKey = process.env.TWENTY_API_KEY;
    this.baseUrl = process.env.TWENTY_BASE_URL || "https://api.twenty.com";

    // Map object names to UUIDs for instances that require UUIDs in Core API paths (e.g. twenty.lhapache.cloud)
    this.coreObjectIds = {
      people: "7b7a2149-900c-4605-bf84-75299ccd142d",
      person: "7b7a2149-900c-4605-bf84-75299ccd142d",
      companies: "4e430e05-d860-4203-a3d3-e4ab748b473d",
      company: "4e430e05-d860-4203-a3d3-e4ab748b473d",
      notes: "6a0eb53b-6058-4f6e-a9b9-d96c1c5da5fe",
      note: "6a0eb53b-6058-4f6e-a9b9-d96c1c5da5fe",
      tasks: "69e03340-7969-4814-9a30-c4482fd87aae",
      task: "69e03340-7969-4814-9a30-c4482fd87aae",
      inboundLeads: "11a08bf2-9884-4aa4-acca-6bc0e9a4bc0e",
      inboundLead: "11a08bf2-9884-4aa4-acca-6bc0e9a4bc0e",
    };

    if (!this.apiKey) {
      throw new Error("TWENTY_API_KEY environment variable is required");
    }

    this.setupToolHandlers();
  }

  getCoreObjectId(name) {
    return this.coreObjectIds[name] || name;
  }

  async makeRequest(endpoint, method = "GET", data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async makeGraphqlRequest(endpoint, query, variables = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    };

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      let result;

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      if (result?.errors?.length) {
        throw new Error(JSON.stringify(result.errors, null, 2));
      }

      return result;
    } catch (error) {
      throw new Error(`GraphQL request failed: ${error.message}`);
    }
  }

  cleanJsonValue(value) {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value
        .map((entry) => this.cleanJsonValue(entry))
        .filter((entry) => entry !== undefined);
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .map(([key, entry]) => [key, this.cleanJsonValue(entry)])
          .filter(([, entry]) => entry !== undefined)
      );
    }

    return value;
  }

  formatToolResult(label, result) {
    return {
      content: [
        {
          type: "text",
          text: `${label}: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  formatMutationError(operation, errors) {
    return new Error(
      `${operation} failed for all attempted mutation shapes:\n${errors
        .map((entry) => `- ${entry.name}: ${entry.message}`)
        .join("\n")}`
    );
  }

  async runMetadataMutation(operation, attempts) {
    const errors = [];

    for (const attempt of attempts) {
      try {
        return await this.makeGraphqlRequest("/metadata", attempt.query, attempt.variables);
      } catch (error) {
        errors.push({
          name: attempt.name,
          message: error.message,
        });
      }
    }

    throw this.formatMutationError(operation, errors);
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // People Management
          {
            name: "create_person",
            description: "Create a new person in Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                firstName: { type: "string", description: "First name" },
                lastName: { type: "string", description: "Last name" },
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                jobTitle: { type: "string", description: "Job title" },
                companyId: { type: "string", description: "Company ID to associate with" },
                linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
                city: { type: "string", description: "City" },
                avatarUrl: { type: "string", description: "Avatar image URL" }
              },
              required: ["firstName", "lastName"]
            }
          },
          {
            name: "get_person",
            description: "Get details of a specific person by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Person ID" }
              },
              required: ["id"]
            }
          },
          {
            name: "update_person",
            description: "Update an existing person's information",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Person ID" },
                firstName: { type: "string", description: "First name" },
                lastName: { type: "string", description: "Last name" },
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                jobTitle: { type: "string", description: "Job title" },
                companyId: { type: "string", description: "Company ID" },
                linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
                city: { type: "string", description: "City" }
              },
              required: ["id"]
            }
          },
          {
            name: "list_people",
            description: "List people with optional filtering and pagination",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Number of results to return (default: 20)" },
                offset: { type: "number", description: "Number of results to skip (default: 0)" },
                search: { type: "string", description: "Search term for name or email" },
                companyId: { type: "string", description: "Filter by company ID" }
              }
            }
          },
          {
            name: "delete_person",
            description: "Delete a person from Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Person ID to delete" }
              },
              required: ["id"]
            }
          },

          // Company Management
          {
            name: "create_company",
            description: "Create a new company in Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Company name" },
                domainName: { type: "string", description: "Company domain" },
                address: { type: "string", description: "Company address" },
                employees: { type: "number", description: "Number of employees" },
                linkedinUrl: { type: "string", description: "LinkedIn company URL" },
                xUrl: { type: "string", description: "X (Twitter) URL" },
                annualRecurringRevenue: { type: "number", description: "Annual recurring revenue" },
                idealCustomerProfile: { type: "boolean", description: "Is this an ideal customer profile" }
              },
              required: ["name"]
            }
          },
          {
            name: "get_company",
            description: "Get details of a specific company by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Company ID" }
              },
              required: ["id"]
            }
          },
          {
            name: "update_company",
            description: "Update an existing company's information",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Company ID" },
                name: { type: "string", description: "Company name" },
                domainName: { type: "string", description: "Company domain" },
                address: { type: "string", description: "Company address" },
                employees: { type: "number", description: "Number of employees" },
                linkedinUrl: { type: "string", description: "LinkedIn company URL" },
                annualRecurringRevenue: { type: "number", description: "Annual recurring revenue" }
              },
              required: ["id"]
            }
          },
          {
            name: "list_companies",
            description: "List companies with optional filtering and pagination",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Number of results to return (default: 20)" },
                offset: { type: "number", description: "Number of results to skip (default: 0)" },
                search: { type: "string", description: "Search term for company name" }
              }
            }
          },
          {
            name: "delete_company",
            description: "Delete a company from Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Company ID to delete" }
              },
              required: ["id"]
            }
          },

          // Notes Management
          {
            name: "create_note",
            description: "Create a new note in Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Note title" },
                body: { type: "string", description: "Note content" },
                position: { type: "number", description: "Position for ordering" }
              },
              required: ["title", "body"]
            }
          },
          {
            name: "get_note",
            description: "Get details of a specific note by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Note ID" }
              },
              required: ["id"]
            }
          },
          {
            name: "list_notes",
            description: "List notes with optional filtering and pagination",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Number of results to return (default: 20)" },
                offset: { type: "number", description: "Number of results to skip (default: 0)" },
                search: { type: "string", description: "Search term for note title or content" }
              }
            }
          },
          {
            name: "update_note",
            description: "Update an existing note",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Note ID" },
                title: { type: "string", description: "Note title" },
                body: { type: "string", description: "Note content" },
                position: { type: "number", description: "Position for ordering" }
              },
              required: ["id"]
            }
          },
          {
            name: "delete_note",
            description: "Delete a note from Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Note ID to delete" }
              },
              required: ["id"]
            }
          },

          // Tasks Management
          {
            name: "create_task",
            description: "Create a new task in Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Task title" },
                body: { type: "string", description: "Task description" },
                dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
                status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
                assigneeId: { type: "string", description: "ID of person assigned to task" },
                position: { type: "number", description: "Position for ordering" }
              },
              required: ["title"]
            }
          },
          {
            name: "get_task",
            description: "Get details of a specific task by ID",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Task ID" }
              },
              required: ["id"]
            }
          },
          {
            name: "list_tasks",
            description: "List tasks with optional filtering and pagination",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Number of results to return (default: 20)" },
                offset: { type: "number", description: "Number of results to skip (default: 0)" },
                status: { type: "string", description: "Filter by status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
                assigneeId: { type: "string", description: "Filter by assignee ID" }
              }
            }
          },
          {
            name: "update_task",
            description: "Update an existing task",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Task ID" },
                title: { type: "string", description: "Task title" },
                body: { type: "string", description: "Task description" },
                dueAt: { type: "string", description: "Due date (ISO 8601 format)" },
                status: { type: "string", description: "Task status", enum: ["TODO", "IN_PROGRESS", "DONE"] },
                assigneeId: { type: "string", description: "ID of person assigned to task" }
              },
              required: ["id"]
            }
          },
          {
            name: "delete_task",
            description: "Delete a task from Twenty CRM",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Task ID to delete" }
              },
              required: ["id"]
            }
          },

          // Metadata Operations
          {
            name: "get_metadata_objects",
            description: "Get all object types and their metadata",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "get_object_metadata",
            description: "Get metadata for a specific object type",
            inputSchema: {
              type: "object",
              properties: {
                objectName: { type: "string", description: "Object name (e.g., 'people', 'companies')" }
              },
              required: ["objectName"]
            }
          },
          {
            name: "create_object_field",
            description: "Create a custom field on a Twenty object through the metadata GraphQL API",
            inputSchema: {
              type: "object",
              properties: {
                objectName: { type: "string", description: "Object name, e.g. inboundLeads" },
                type: { type: "string", description: "FieldMetadataType value, e.g. TEXT, NUMBER, BOOLEAN" },
                name: { type: "string", description: "API field name" },
                label: { type: "string", description: "Human-readable field label" },
                description: { type: "string", description: "Field description" },
                icon: { type: "string", description: "Optional icon name" },
                isCustom: { type: "boolean", description: "Whether the field is custom" },
                isActive: { type: "boolean", description: "Whether the field is active" },
                isSystem: { type: "boolean", description: "Whether the field is system-managed" },
                isUIReadOnly: { type: "boolean", description: "Whether the field is read-only in the UI" },
                isNullable: { type: "boolean", description: "Whether the field can be null" },
                isUnique: { type: "boolean", description: "Whether the field must be unique" },
                defaultValue: { type: ["string", "number", "boolean", "object", "array", "null"], description: "Default value" },
                options: { type: ["object", "array", "null"], description: "Options payload for select-like fields" },
                settings: { type: ["object", "array", "null"], description: "Settings payload" },
                isLabelSyncedWithName: { type: "boolean", description: "Sync label with name" },
                isRemoteCreation: { type: "boolean", description: "Whether the field was created remotely" },
                relationCreationPayload: { type: ["object", "array", "null"], description: "Relation creation payload" },
                morphRelationsCreationPayload: { type: "array", items: { type: ["object", "array", "string", "number", "boolean", "null"] }, description: "Morph relation creation payload" }
              },
              required: ["objectName", "type", "name", "label"]
            }
          },
          {
            name: "update_object_field",
            description: "Update a custom field on a Twenty object through the metadata GraphQL API",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Field metadata UUID" },
                type: { type: "string", description: "FieldMetadataType value" },
                name: { type: "string", description: "API field name" },
                label: { type: "string", description: "Human-readable field label" },
                description: { type: "string", description: "Field description" },
                icon: { type: "string", description: "Optional icon name" },
                isCustom: { type: "boolean", description: "Whether the field is custom" },
                isActive: { type: "boolean", description: "Whether the field is active" },
                isSystem: { type: "boolean", description: "Whether the field is system-managed" },
                isUIReadOnly: { type: "boolean", description: "Whether the field is read-only in the UI" },
                isNullable: { type: "boolean", description: "Whether the field can be null" },
                isUnique: { type: "boolean", description: "Whether the field must be unique" },
                defaultValue: { type: ["string", "number", "boolean", "object", "array", "null"], description: "Default value" },
                options: { type: ["object", "array", "null"], description: "Options payload for select-like fields" },
                settings: { type: ["object", "array", "null"], description: "Settings payload" },
                isLabelSyncedWithName: { type: "boolean", description: "Sync label with name" },
                isRemoteCreation: { type: "boolean", description: "Whether the field was created remotely" },
                relationCreationPayload: { type: ["object", "array", "null"], description: "Relation creation payload" },
                morphRelationsCreationPayload: { type: "array", items: { type: ["object", "array", "string", "number", "boolean", "null"] }, description: "Morph relation creation payload" }
              },
              required: ["id"]
            }
          },
          {
            name: "delete_object_field",
            description: "Delete a custom field from a Twenty object through the metadata GraphQL API",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Field metadata UUID" }
              },
              required: ["id"]
            }
          },

          // Search and Enrichment
          {
            name: "search_records",
            description: "Search across multiple object types",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
                objectTypes: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Object types to search (e.g., ['people', 'companies'])" 
                },
                limit: { type: "number", description: "Number of results per object type" }
              },
              required: ["query"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // People operations
          case "create_person":
            return await this.createPerson(args);
          case "get_person":
            return await this.getPerson(args.id);
          case "update_person":
            return await this.updatePerson(args);
          case "list_people":
            return await this.listPeople(args);
          case "delete_person":
            return await this.deletePerson(args.id);

          // Company operations
          case "create_company":
            return await this.createCompany(args);
          case "get_company":
            return await this.getCompany(args.id);
          case "update_company":
            return await this.updateCompany(args);
          case "list_companies":
            return await this.listCompanies(args);
          case "delete_company":
            return await this.deleteCompany(args.id);

          // Note operations
          case "create_note":
            return await this.createNote(args);
          case "get_note":
            return await this.getNote(args.id);
          case "list_notes":
            return await this.listNotes(args);
          case "update_note":
            return await this.updateNote(args);
          case "delete_note":
            return await this.deleteNote(args.id);

          // Task operations
          case "create_task":
            return await this.createTask(args);
          case "get_task":
            return await this.getTask(args.id);
          case "list_tasks":
            return await this.listTasks(args);
          case "update_task":
            return await this.updateTask(args);
          case "delete_task":
            return await this.deleteTask(args.id);

          // Metadata operations
          case "get_metadata_objects":
            return await this.getMetadataObjects();
          case "get_object_metadata":
            return await this.getObjectMetadata(args.objectName);
          case "create_object_field":
            return await this.createObjectField(args);
          case "update_object_field":
            return await this.updateObjectField(args);
          case "delete_object_field":
            return await this.deleteObjectField(args.id);

          // Search operations
          case "search_records":
            return await this.searchRecords(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  // People methods
  async createPerson(data) {
    const result = await this.makeRequest("/rest/people", "POST", data);
    return {
      content: [
        {
          type: "text",
          text: `Created person: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async getPerson(id) {
    const result = await this.makeRequest(`/rest/people/${id}`);
    return {
      content: [
        {
          type: "text",
          text: `Person details: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async updatePerson(data) {
    const { id, ...updateData } = data;
    const result = await this.makeRequest(`/rest/people/${id}`, "PUT", updateData);
    return {
      content: [
        {
          type: "text",
          text: `Updated person: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async listPeople(params = {}) {
    const { limit = 20, offset = 0, search, companyId } = params;
    let endpoint = `/rest/people?limit=${limit}&offset=${offset}`;
    
    if (search) {
      endpoint += `&search=${encodeURIComponent(search)}`;
    }
    if (companyId) {
      endpoint += `&companyId=${companyId}`;
    }

    const result = await this.makeRequest(endpoint);
    return {
      content: [
        {
          type: "text",
          text: `People list: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async deletePerson(id) {
    await this.makeRequest(`/rest/people/${id}`, "DELETE");
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted person with ID: ${id}`
        }
      ]
    };
  }

  // Company methods
  async createCompany(data) {
    const result = await this.makeRequest("/rest/companies", "POST", data);
    return {
      content: [
        {
          type: "text",
          text: `Created company: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async getCompany(id) {
    const result = await this.makeRequest(`/rest/companies/${id}`);
    return {
      content: [
        {
          type: "text",
          text: `Company details: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async updateCompany(data) {
    const { id, ...updateData } = data;
    const result = await this.makeRequest(`/rest/companies/${id}`, "PUT", updateData);
    return {
      content: [
        {
          type: "text",
          text: `Updated company: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async listCompanies(params = {}) {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/companies?limit=${limit}&offset=${offset}`;
    
    if (search) {
      endpoint += `&search=${encodeURIComponent(search)}`;
    }

    const result = await this.makeRequest(endpoint);
    return {
      content: [
        {
          type: "text",
          text: `Companies list: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async deleteCompany(id) {
    await this.makeRequest(`/rest/companies/${id}`, "DELETE");
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted company with ID: ${id}`
        }
      ]
    };
  }

  // Note methods
  async createNote(data) {
    const result = await this.makeRequest("/rest/notes", "POST", data);
    return {
      content: [
        {
          type: "text",
          text: `Created note: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async getNote(id) {
    const result = await this.makeRequest(`/rest/notes/${id}`);
    return {
      content: [
        {
          type: "text",
          text: `Note details: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async listNotes(params = {}) {
    const { limit = 20, offset = 0, search } = params;
    let endpoint = `/rest/notes?limit=${limit}&offset=${offset}`;
    
    if (search) {
      endpoint += `&search=${encodeURIComponent(search)}`;
    }

    const result = await this.makeRequest(endpoint);
    return {
      content: [
        {
          type: "text",
          text: `Notes list: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async updateNote(data) {
    const { id, ...updateData } = data;
    const result = await this.makeRequest(`/rest/notes/${id}`, "PUT", updateData);
    return {
      content: [
        {
          type: "text",
          text: `Updated note: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async deleteNote(id) {
    await this.makeRequest(`/rest/notes/${id}`, "DELETE");
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted note with ID: ${id}`
        }
      ]
    };
  }

  // Task methods
  async createTask(data) {
    const result = await this.makeRequest("/rest/tasks", "POST", data);
    return {
      content: [
        {
          type: "text",
          text: `Created task: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async getTask(id) {
    const result = await this.makeRequest(`/rest/tasks/${id}`);
    return {
      content: [
        {
          type: "text",
          text: `Task details: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async listTasks(params = {}) {
    const { limit = 20, offset = 0, status, assigneeId } = params;
    let endpoint = `/rest/tasks?limit=${limit}&offset=${offset}`;
    
    if (status) {
      endpoint += `&status=${status}`;
    }
    if (assigneeId) {
      endpoint += `&assigneeId=${assigneeId}`;
    }

    const result = await this.makeRequest(endpoint);
    return {
      content: [
        {
          type: "text",
          text: `Tasks list: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async updateTask(data) {
    const { id, ...updateData } = data;
    const result = await this.makeRequest(`/rest/tasks/${id}`, "PUT", updateData);
    return {
      content: [
        {
          type: "text",
          text: `Updated task: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async deleteTask(id) {
    await this.makeRequest(`/rest/tasks/${id}`, "DELETE");
    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted task with ID: ${id}`
        }
      ]
    };
  }

  // Metadata methods
  async getMetadataObjects() {
    const result = await this.makeRequest("/rest/metadata/objects");
    return {
      content: [
        {
          type: "text",
          text: `Metadata objects: ${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  }

  async getObjectMetadata(objectName) {
    const result = await this.makeRequest(`/rest/metadata/objects/${this.getCoreObjectId(objectName)}`);
    return this.formatToolResult(`Metadata for ${objectName}`, result);
  }

  buildFieldMutationPayload(data, includeObjectMetadataId = false) {
    const payload = { ...data };

    if (includeObjectMetadataId) {
      const objectName = payload.objectName;
      delete payload.objectName;
      payload.objectMetadataId = this.getCoreObjectId(objectName);
    }

    return this.cleanJsonValue(payload);
  }

  async createObjectField(data) {
    const input = this.buildFieldMutationPayload(data, true);
    const selection = `
      id
      name
      label
      type
      isCustom
      isActive
      isNullable
      isUnique
    `;
    const result = await this.runMetadataMutation("create_object_field", [
      {
        name: "createOneField_nested_field",
        query: `
          mutation CreateOneField($field: CreateFieldInput!) {
            createOneField(input: { field: $field }) {
              ${selection}
            }
          }
        `,
        variables: { field: input },
      },
      {
        name: "createOneField_metadata_input",
        query: `
          mutation CreateOneField($input: CreateOneFieldMetadataInput!) {
            createOneField(input: $input) {
              ${selection}
            }
          }
        `,
        variables: { input: { field: input } },
      },
      {
        name: "createOneField_input_direct",
        query: `
          mutation CreateOneField($input: CreateFieldInput!) {
            createOneField(input: $input) {
              ${selection}
            }
          }
        `,
        variables: { input },
      },
    ]);

    return this.formatToolResult("Created object field", result);
  }

  async updateObjectField(data) {
    const { id, ...fieldUpdates } = data;
    const update = this.buildFieldMutationPayload(fieldUpdates, false);
    const selection = `
      id
      name
      label
      type
      isCustom
      isActive
      isNullable
      isUnique
    `;
    const result = await this.runMetadataMutation("update_object_field", [
      {
        name: "updateOneField_id_update",
        query: `
          mutation UpdateOneField($id: UUID!, $update: UpdateFieldInput!) {
            updateOneField(input: { id: $id, update: $update }) {
              ${selection}
            }
          }
        `,
        variables: { id, update },
      },
      {
        name: "updateOneField_id_field",
        query: `
          mutation UpdateOneField($id: UUID!, $field: UpdateFieldInput!) {
            updateOneField(input: { id: $id, field: $field }) {
              ${selection}
            }
          }
        `,
        variables: { id, field: update },
      },
      {
        name: "updateOneField_update_one_input",
        query: `
          mutation UpdateOneField($input: UpdateOneFieldInput!) {
            updateOneField(input: $input) {
              ${selection}
            }
          }
        `,
        variables: { input: { id, update } },
      },
    ]);

    return this.formatToolResult("Updated object field", result);
  }

  async deleteObjectField(id) {
    const selection = `
      id
      name
      label
      type
    `;
    const result = await this.runMetadataMutation("delete_object_field", [
      {
        name: "deleteOneField_input_id",
        query: `
          mutation DeleteOneField($id: UUID!) {
            deleteOneField(input: { id: $id }) {
              ${selection}
            }
          }
        `,
        variables: { id },
      },
      {
        name: "deleteOneField_direct_id",
        query: `
          mutation DeleteOneField($id: UUID!) {
            deleteOneField(id: $id) {
              ${selection}
            }
          }
        `,
        variables: { id },
      },
      {
        name: "deleteOneField_delete_one_input",
        query: `
          mutation DeleteOneField($input: DeleteOneFieldInput!) {
            deleteOneField(input: $input) {
              ${selection}
            }
          }
        `,
        variables: { input: { id } },
      },
    ]);

    return this.formatToolResult("Deleted object field", result);
  }

  // Search methods
  async searchRecords(params) {
    const { query, objectTypes = ['people', 'companies'], limit = 10 } = params;
    const results = {};

    for (const objectType of objectTypes) {
      try {
        const endpoint = `/rest/${objectType}?search=${encodeURIComponent(query)}&limit=${limit}`;
        results[objectType] = await this.makeRequest(endpoint);
      } catch (error) {
        results[objectType] = { error: error.message };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Search results for "${query}": ${JSON.stringify(results, null, 2)}`
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Twenty CRM MCP server running on stdio");
  }
}

const server = new TwentyCRMServer();
server.run().catch(console.error);