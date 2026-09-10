using System;
using System.Collections.Generic;
using System.Text;

namespace WireManager.Core.Models
{
    public class Audit
    {

        public int Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string ActorId { get; set; }     // uuid user 
        public string ActorType { get; set; }   // operator, system, admin
        public string Action { get; set; }      // create, update, delete, read
        public string Entity { get; set; }      // user, server, policy, etc
        public string? EntityId { get; set; }    // id of the entity being acted upon
        public bool IsSuccess { get; set; }     // true if the action was successful, false otherwise
        public string? Details { get; set; }     // additional details about the action
    }
}
