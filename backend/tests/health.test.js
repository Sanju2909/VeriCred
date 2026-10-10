const request = require("supertest");
const { expect } = require("chai");
const app = require("../src/app");

describe("Backend Foundation & Health API", function () {
  it("GET /api/health should return 200 with service health data", async function () {
    const res = await request(app).get("/api/health");

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("success", true);
    expect(res.body).to.have.property("data");
    expect(res.body.data).to.have.property("status");
    expect(res.body.data).to.have.property("timestamp");
    expect(res.body.data).to.have.property("uptimeSeconds");
    expect(res.body.data).to.have.property("database");
    expect(res.body.data.database).to.have.property("connected");
  });

  it("GET /api/nonexistent-route should return 404 with standard error structure", async function () {
    const res = await request(app).get("/api/nonexistent-route");

    expect(res.status).to.equal(404);
    expect(res.body).to.have.property("success", false);
    expect(res.body).to.have.property("error");
    expect(res.body.error).to.have.property("code", "NOT_FOUND");
  });

  it("POST /api/health with invalid JSON should trigger 400 error handler", async function () {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{ malformed json");

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("success", false);
    expect(res.body.error).to.have.property("code", "INVALID_JSON_BODY");
  });
});

