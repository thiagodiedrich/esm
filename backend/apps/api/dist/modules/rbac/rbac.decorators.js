"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermission = void 0;
const common_1 = require("@nestjs/common");
const rbac_constants_1 = require("./rbac.constants");
const RequirePermission = (resource, action) => (0, common_1.SetMetadata)(rbac_constants_1.PERMISSION_METADATA_KEY, { resource, action });
exports.RequirePermission = RequirePermission;
