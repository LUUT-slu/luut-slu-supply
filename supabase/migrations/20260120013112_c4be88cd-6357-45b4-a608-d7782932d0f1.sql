
-- Fix: Add 'completed' to allowed assignment_status values
ALTER TABLE order_assignments 
DROP CONSTRAINT order_assignments_status_check;

ALTER TABLE order_assignments 
ADD CONSTRAINT order_assignments_status_check 
CHECK (assignment_status = ANY (ARRAY['pending', 'accepted', 'declined', 'reassigned', 'completed']));
